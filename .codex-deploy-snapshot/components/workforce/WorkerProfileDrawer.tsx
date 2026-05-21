"use client";

import { X } from "lucide-react";
import type {
  Stage1ReadinessStatus,
  Stage1TrainingDetail,
  Stage1TrainingStatus,
  Stage1TrainingSummary,
} from "@/lib/trainingMatrixStage1";
import {
  EmptyState,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

export type WorkerProfileTab = "summary" | "training" | "permits" | "jobsites" | "documents" | "actions" | "access" | "audit";

export type WorkerProfileRecord = {
  id: string;
  source: "user" | "tracked";
  name: string;
  email: string | null;
  role: string | null;
  status: string | null;
  workerType: string;
  loginAccessStatus: "Active User" | "Invited User" | "Disabled User" | "No Portal Access";
  companyOrDepartment: string;
  jobTitleOrTrade: string;
  assignedJobsites: string[];
  supervisorOrManager: string;
  readinessStatus: Stage1ReadinessStatus | string;
  trainingStatus: Stage1ReadinessStatus | string;
  permitExposureStatus: string;
  accessStatus: string;
  lastUpdated: string | null;
  restrictions?: string[];
  trainingRequirements: Stage1TrainingDetail[];
  trainingSummary?: Stage1TrainingSummary;
};

export type WorkerProfileMatrixRow = {
  userId: string;
  trackedEmployeeId?: string;
  personType?: "licensed_user" | "tracked_employee";
  name: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  workerType?: string;
  loginAccessStatus?: WorkerProfileRecord["loginAccessStatus"];
  companyOrDepartment?: string;
  jobTitleOrTrade?: string;
  assignedJobsites?: string[];
  supervisorOrManager?: string;
  readinessStatus?: Stage1ReadinessStatus | string;
  trainingStatus?: Stage1ReadinessStatus | string;
  permitExposureStatus?: string;
  accessStatus?: string;
  lastUpdated?: string | null;
  trainingRequirements?: Stage1TrainingDetail[];
  trainingSummary?: Stage1TrainingSummary;
  profileFields?: {
    tradeSpecialty?: string | null;
    jobTitle?: string | null;
    readinessStatus?: string | null;
  };
};

export type WorkerProfileDirectoryRow = {
  id: string;
  source: "user" | "tracked";
  name: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  workerType: string;
  loginAccess: WorkerProfileRecord["loginAccessStatus"];
  companyOrDepartment: string;
  jobTitleOrTrade: string;
  assignedJobsite: string;
  supervisorOrManager: string;
  readinessStatus: string;
  trainingStatus: string;
  permitExposure: string;
  lastUpdated: string | null;
};

const tabs: Array<{ id: WorkerProfileTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "training", label: "Training" },
  { id: "permits", label: "Permits" },
  { id: "jobsites", label: "Jobsites" },
  { id: "documents", label: "Documents" },
  { id: "actions", label: "Actions" },
  { id: "access", label: "Access" },
  { id: "audit", label: "Audit Log" },
];

function cleanText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "none") return fallback;
  return text;
}

function cleanList(values: string[] | undefined, fallback: string) {
  const cleaned = (values ?? []).map((value) => cleanText(value, "")).filter(Boolean);
  return cleaned.length ? cleaned : [fallback];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "W") + (parts[1]?.[0] ?? "");
}

function statusTone(status: Stage1TrainingStatus | Stage1ReadinessStatus | string): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "Complete" || status === "Ready" || status === "Active User") return "success";
  if (status === "Expiring Soon" || status === "Ready With Warnings" || status === "Invited User") return "warning";
  if (status === "Overdue" || status === "Expired" || status === "Not Ready" || status === "Restricted" || status === "Blocked" || status === "Disabled User") return "error";
  if (status === "In Progress" || status === "Pending Review" || status === "No Portal Access") return "info";
  return "neutral";
}

function isIncompleteTrainingStatus(status: Stage1TrainingStatus | string) {
  return status === "Missing" || status === "Expired" || status === "Overdue" || status === "Awaiting Approval";
}

function hasVisibleEvidence(detail: Stage1TrainingDetail) {
  const evidence = cleanText(detail.evidenceStatus, "");
  return Boolean(evidence) && evidence !== "Missing evidence" && evidence !== "Not required";
}

export function workerProfileIdForDirectoryRow(row: Pick<WorkerProfileDirectoryRow, "id" | "source">) {
  return row.source === "tracked" ? `tracked:${row.id}` : row.id;
}

export function buildWorkerProfileFromDirectoryRow(row: WorkerProfileDirectoryRow): WorkerProfileRecord {
  return {
    id: workerProfileIdForDirectoryRow(row),
    source: row.source,
    name: cleanText(row.name, "Unnamed worker"),
    email: cleanText(row.email, "") || null,
    role: cleanText(row.role, row.jobTitleOrTrade) || null,
    status: cleanText(row.status, "") || null,
    workerType: cleanText(row.workerType, row.source === "tracked" ? "External Worker" : "Employee"),
    loginAccessStatus: row.loginAccess,
    companyOrDepartment: cleanText(row.companyOrDepartment, "Not set"),
    jobTitleOrTrade: cleanText(row.jobTitleOrTrade, "Not set"),
    assignedJobsites: cleanList(row.assignedJobsite.split(",").map((item) => item.trim()), "No jobsite assigned"),
    supervisorOrManager: cleanText(row.supervisorOrManager, row.source === "tracked" ? "Responsible manager not assigned" : "Not assigned"),
    readinessStatus: cleanText(row.readinessStatus, "Pending Review"),
    trainingStatus: cleanText(row.trainingStatus, "Pending Review"),
    permitExposureStatus: cleanText(row.permitExposure, "No permit-linked training gaps found"),
    accessStatus: row.loginAccess === "No Portal Access" ? "Restricted" : row.loginAccess,
    lastUpdated: cleanText(row.lastUpdated, "Updated recently"),
    trainingRequirements: [],
  };
}

export function buildWorkerProfileFromMatrixRow(row: WorkerProfileMatrixRow): WorkerProfileRecord {
  const tracked = row.personType === "tracked_employee" || row.userId.startsWith("tracked:");
  const assignedJobsites = cleanList(row.assignedJobsites, "No jobsite assigned");
  const roleText = cleanText(row.role, "");
  const jobTitleOrTrade =
    cleanText(row.jobTitleOrTrade, "") ||
    [row.profileFields?.jobTitle, row.profileFields?.tradeSpecialty].map((item) => cleanText(item, "")).filter(Boolean).join(" / ");
  return {
    id: row.userId,
    source: tracked ? "tracked" : "user",
    name: cleanText(row.name, "Unnamed worker"),
    email: cleanText(row.email, "") || null,
    role: roleText || null,
    status: cleanText(row.status, "") || null,
    workerType: cleanText(row.workerType, tracked ? "External Worker" : "Employee"),
    loginAccessStatus: row.loginAccessStatus ?? (tracked ? "No Portal Access" : "Active User"),
    companyOrDepartment: cleanText(row.companyOrDepartment, "Not set"),
    jobTitleOrTrade: cleanText(jobTitleOrTrade, "Not set"),
    assignedJobsites,
    supervisorOrManager: cleanText(row.supervisorOrManager, tracked ? "Responsible manager not assigned" : "Not assigned"),
    readinessStatus: cleanText(row.readinessStatus, row.trainingSummary?.overallStatus ?? "Pending Review"),
    trainingStatus: cleanText(row.trainingStatus, row.trainingSummary?.overallStatus ?? "Pending Review"),
    permitExposureStatus: cleanText(row.permitExposureStatus, "No permit-linked training gaps found"),
    accessStatus: cleanText(row.accessStatus, tracked ? "Restricted" : row.loginAccessStatus ?? "Active User"),
    lastUpdated: cleanText(row.lastUpdated, "Updated recently"),
    trainingRequirements: row.trainingRequirements ?? [],
    trainingSummary: row.trainingSummary,
  };
}

export function mergeWorkerProfiles(directoryProfile: WorkerProfileRecord | null, matrixProfile: WorkerProfileRecord | null) {
  if (!directoryProfile) return matrixProfile;
  if (!matrixProfile) return directoryProfile;
  return {
    ...matrixProfile,
    name: directoryProfile.name,
    email: directoryProfile.email ?? matrixProfile.email,
    role: directoryProfile.role ?? matrixProfile.role,
    status: directoryProfile.status ?? matrixProfile.status,
    workerType: directoryProfile.workerType,
    loginAccessStatus: directoryProfile.loginAccessStatus,
    companyOrDepartment: directoryProfile.companyOrDepartment,
    jobTitleOrTrade: directoryProfile.jobTitleOrTrade,
    assignedJobsites: directoryProfile.assignedJobsites,
    supervisorOrManager: directoryProfile.supervisorOrManager,
    lastUpdated: directoryProfile.lastUpdated ?? matrixProfile.lastUpdated,
    accessStatus: directoryProfile.accessStatus || matrixProfile.accessStatus,
  };
}

function SummaryMetric({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "success" | "warning" | "error" | "info" | "neutral" }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 shadow-[var(--app-shadow-soft)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</p>
      <div className="mt-2">
        <StatusBadge label={String(value)} tone={tone} />
      </div>
    </div>
  );
}

export function WorkerProfileDrawer({
  profile,
  activeTab,
  onTabChange,
  onClose,
}: {
  profile: WorkerProfileRecord | null;
  activeTab: WorkerProfileTab;
  onTabChange: (tab: WorkerProfileTab) => void;
  onClose: () => void;
}) {
  if (!profile) return null;
  const summary = profile.trainingSummary;
  const permitGaps = profile.trainingRequirements.filter(
    (detail) => detail.requirementSources.includes("Permit exposure") && detail.status !== "Complete" && detail.status !== "Not Applicable"
  );
  const assignedJobsites = profile.assignedJobsites.filter((jobsite) => jobsite !== "No jobsite assigned");
  const siteTrainingRows = profile.trainingRequirements.filter((detail) => detail.requirementSources.includes("Site requirement"));
  const documentRows = profile.trainingRequirements.filter(hasVisibleEvidence);
  const actionRows = profile.trainingRequirements.filter(
    (detail) => isIncompleteTrainingStatus(detail.status) || detail.status === "Expiring Soon" || Boolean(detail.preventionMessage)
  );
  const preventionMessages = profile.trainingRequirements
    .map((detail) => detail.preventionMessage)
    .filter((message): message is string => Boolean(cleanText(message, "")));
  const noPortal = profile.loginAccessStatus === "No Portal Access";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${profile.name} worker profile`}>
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Close worker profile" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl">
        <div className="border-b border-[var(--app-border)] bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-primary)] text-lg font-bold text-white">
                {initials(profile.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">Worker profile</p>
                <h2 className="mt-1 truncate text-2xl font-bold text-[var(--app-text-strong)]">{profile.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge label={profile.workerType} tone="neutral" />
                  <StatusBadge label={profile.loginAccessStatus} tone={statusTone(profile.loginAccessStatus)} />
                  <StatusBadge label={`Readiness: ${profile.readinessStatus}`} tone={statusTone(profile.readinessStatus)} />
                  <StatusBadge label={`Access: ${profile.accessStatus}`} tone={statusTone(profile.accessStatus)} />
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--app-border)] bg-white p-2 text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]" aria-label="Close worker profile">
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <HeaderFact label="Company / department" value={profile.companyOrDepartment} />
            <HeaderFact label="Job title / trade" value={profile.jobTitleOrTrade} />
            <HeaderFact label={noPortal ? "Responsible manager" : "Supervisor / manager"} value={profile.supervisorOrManager} />
            <HeaderFact label="Assigned jobsite" value={profile.assignedJobsites.join(", ")} />
          </div>
        </div>

        <div className="border-b border-[var(--app-border)] bg-white px-5 py-2">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Worker profile tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={
                  activeTab === tab.id
                    ? "rounded-lg bg-[var(--app-accent-primary)] px-3 py-2 text-xs font-bold text-white"
                    : "rounded-lg px-3 py-2 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-panel-soft)]"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {activeTab === "summary" ? (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric label="Overall readiness" value={profile.readinessStatus} tone={statusTone(profile.readinessStatus)} />
                <SummaryMetric label="Training compliance" value={profile.trainingStatus} tone={statusTone(profile.trainingStatus)} />
                <SummaryMetric label="Expiring soon" value={summary?.expiringSoonCount ?? 0} tone={(summary?.expiringSoonCount ?? 0) > 0 ? "warning" : "success"} />
                <SummaryMetric label="Overdue" value={summary?.overdueCount ?? 0} tone={(summary?.overdueCount ?? 0) > 0 ? "error" : "success"} />
                <SummaryMetric label="Permit exposure" value={profile.permitExposureStatus} tone={(summary?.permitLinkedGaps ?? 0) > 0 ? "error" : "success"} />
                <SummaryMetric label="Site access" value={profile.accessStatus} tone={statusTone(profile.accessStatus)} />
                <SummaryMetric label="Open actions" value={preventionMessages.length} tone={preventionMessages.length ? "warning" : "success"} />
                <SummaryMetric label="Next due training" value={summary?.nextDueDate ?? "No upcoming due date"} tone={summary?.nextDueDate ? "warning" : "success"} />
              </div>
              {preventionMessages.length ? (
                <div className="rounded-lg border border-[rgba(159,31,28,0.22)] bg-[var(--semantic-danger-bg)] p-4">
                  <p className="text-sm font-bold text-[var(--semantic-danger)]">Prevention messages</p>
                  <ul className="mt-2 grid gap-2 text-sm text-[var(--semantic-danger)]">
                    {preventionMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState title="No active prevention blockers" description="No permit-linked training gaps or access restrictions are visible for this worker." align="left" />
              )}
            </div>
          ) : null}

          {activeTab === "training" ? (
            profile.trainingRequirements.length ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--app-border)] bg-white">
                <table className="min-w-[980px] text-left text-sm">
                  <thead className="bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    <tr>
                      {["Training name", "Required because", "Status", "Due date", "Completed", "Expiry", "Evidence", "Trainer / approver", "Version", "Actions"].map((header) => (
                        <th key={header} className="border-b border-[var(--app-border)] px-3 py-3">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.trainingRequirements.map((detail) => (
                      <tr key={detail.requirementId} className="border-b border-[var(--app-border)] align-top">
                        <td className="px-3 py-3 font-semibold text-[var(--app-text-strong)]">{detail.trainingName}</td>
                        <td className="px-3 py-3">{detail.requiredBecause}</td>
                        <td className="px-3 py-3"><StatusBadge label={detail.status} tone={statusTone(detail.status)} /></td>
                        <td className="px-3 py-3">{detail.dueDate ?? "No due date"}</td>
                        <td className="px-3 py-3">{detail.completedDate ?? "Not complete"}</td>
                        <td className="px-3 py-3">{detail.expiryDate ?? "No expiry on file"}</td>
                        <td className="px-3 py-3">{detail.evidenceStatus}</td>
                        <td className="px-3 py-3">{detail.trainerOrApprover}</td>
                        <td className="px-3 py-3">{detail.courseVersion}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="text-xs font-bold text-[var(--app-accent-primary)]">Send reminder</button>
                            <button type="button" className="text-xs font-bold text-[var(--app-accent-primary)]">Create action</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No required training found" description="No required training rows are available for this worker in the current Training Matrix view." align="left" />
            )
          ) : null}

          {activeTab === "permits" ? (
            permitGaps.length ? (
              <div className="grid gap-3">
                {permitGaps.map((detail) => (
                  <div key={detail.requirementId} className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[var(--app-shadow-soft)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--app-text-strong)]">{detail.trainingName}</p>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">Required because: {detail.requiredBecause}</p>
                      </div>
                      <StatusBadge label={detail.status} tone={statusTone(detail.status)} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--semantic-danger)]">
                      {detail.preventionMessage ?? `Worker is restricted from permit-controlled activity until ${detail.trainingName} is current.`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No permit-linked training gaps found" description="This worker has no visible permit exposure blockers in the current matrix view." align="left" />
            )
          ) : null}

          {activeTab === "jobsites" ? (
            assignedJobsites.length ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--app-border)] bg-white">
                <table className="min-w-[820px] text-left text-sm">
                  <thead className="bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    <tr>
                      {["Jobsite", "Role / trade", "Site access", "Required site training", "Missing site training", "Actions"].map((header) => (
                        <th key={header} className="border-b border-[var(--app-border)] px-3 py-3">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignedJobsites.map((jobsite) => {
                      const missingSiteTraining = siteTrainingRows.filter((detail) => isIncompleteTrainingStatus(detail.status));
                      return (
                        <tr key={jobsite} className="border-b border-[var(--app-border)] align-top">
                          <td className="px-3 py-3 font-semibold text-[var(--app-text-strong)]">{jobsite}</td>
                          <td className="px-3 py-3">{profile.jobTitleOrTrade}</td>
                          <td className="px-3 py-3"><StatusBadge label={profile.accessStatus} tone={statusTone(profile.accessStatus)} /></td>
                          <td className="px-3 py-3">{siteTrainingRows.map((detail) => detail.trainingName).join(", ") || "No site-specific training found"}</td>
                          <td className="px-3 py-3">{missingSiteTraining.map((detail) => detail.trainingName).join(", ") || "No missing site training found"}</td>
                          <td className="px-3 py-3"><button type="button" className="text-xs font-bold text-[var(--app-accent-primary)]">Review access</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No jobsite assignments found" description="This worker does not have a current jobsite assignment in the profile data available to this drawer." align="left" />
            )
          ) : null}

          {activeTab === "documents" ? (
            documentRows.length ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--app-border)] bg-white">
                <table className="min-w-[840px] text-left text-sm">
                  <thead className="bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    <tr>
                      {["Document name", "Document type", "Related training", "Uploaded by", "Expiry date", "Status", "Actions"].map((header) => (
                        <th key={header} className="border-b border-[var(--app-border)] px-3 py-3">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documentRows.map((detail) => (
                      <tr key={detail.requirementId} className="border-b border-[var(--app-border)] align-top">
                        <td className="px-3 py-3 font-semibold text-[var(--app-text-strong)]">{detail.trainingName} evidence</td>
                        <td className="px-3 py-3">Training evidence</td>
                        <td className="px-3 py-3">{detail.trainingName}</td>
                        <td className="px-3 py-3">{detail.trainerOrApprover}</td>
                        <td className="px-3 py-3">{detail.expiryDate ?? "No expiry on file"}</td>
                        <td className="px-3 py-3"><StatusBadge label={detail.evidenceStatus} tone={detail.evidenceStatus === "On file" ? "success" : "warning"} /></td>
                        <td className="px-3 py-3"><button type="button" className="text-xs font-bold text-[var(--app-accent-primary)]">View evidence</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No uploaded evidence found" description="No certificate, induction, or approval evidence is visible for this worker in the current matrix data." align="left" />
            )
          ) : null}

          {activeTab === "actions" ? (
            actionRows.length ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--app-border)] bg-white">
                <table className="min-w-[900px] text-left text-sm">
                  <thead className="bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    <tr>
                      {["Action title", "Priority", "Related item", "Owner", "Due date", "Status", "Actions"].map((header) => (
                        <th key={header} className="border-b border-[var(--app-border)] px-3 py-3">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actionRows.map((detail) => {
                      const permitCritical = detail.requirementSources.includes("Permit exposure") && isIncompleteTrainingStatus(detail.status);
                      const title =
                        detail.preventionMessage ??
                        (detail.status === "Expiring Soon"
                          ? `Renew ${detail.trainingName}`
                          : `Resolve ${detail.trainingName} requirement`);
                      return (
                        <tr key={detail.requirementId} className="border-b border-[var(--app-border)] align-top">
                          <td className="px-3 py-3 font-semibold text-[var(--app-text-strong)]">{title}</td>
                          <td className="px-3 py-3"><StatusBadge label={permitCritical ? "High" : "Medium"} tone={permitCritical ? "error" : "warning"} /></td>
                          <td className="px-3 py-3">{detail.trainingName}</td>
                          <td className="px-3 py-3">{profile.supervisorOrManager}</td>
                          <td className="px-3 py-3">{detail.dueDate ?? "No due date"}</td>
                          <td className="px-3 py-3"><StatusBadge label={detail.status === "Expiring Soon" ? "Monitor" : "Open"} tone={detail.status === "Expiring Soon" ? "warning" : "error"} /></td>
                          <td className="px-3 py-3"><button type="button" className="text-xs font-bold text-[var(--app-accent-primary)]">Create action</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No open worker actions found" description="No training, permit, or access actions are visible for this worker in the current profile data." align="left" />
            )
          ) : null}

          {activeTab === "access" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {noPortal ? (
                <>
                  <AccessFact label="Portal access" value="No Portal Access" />
                  <AccessFact label="Responsible manager / sponsor" value={profile.supervisorOrManager} />
                  <AccessFact label="Site access status" value={profile.accessStatus} />
                  <AccessFact label="Assigned jobsite" value={profile.assignedJobsites.join(", ")} />
                  <AccessFact label="Access restrictions" value={profile.restrictions?.join(", ") || "No restrictions recorded"} />
                  <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--app-border)] bg-white p-4">
                    <button type="button" className={appButtonPrimaryClassName}>Convert to system user</button>
                    <button type="button" className={appButtonSecondaryClassName}>Approve site access</button>
                  </div>
                </>
              ) : (
                <>
                  <AccessFact label="Login email" value={profile.email ?? "No email on file"} />
                  <AccessFact label="User role" value={profile.role ?? profile.jobTitleOrTrade} />
                  <AccessFact label="Login access" value={profile.loginAccessStatus} />
                  <AccessFact label="Team access" value={profile.companyOrDepartment} />
                  <AccessFact label="Last updated" value={profile.lastUpdated ?? "Updated recently"} />
                  <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--app-border)] bg-white p-4">
                    <button type="button" className={appButtonSecondaryClassName}>Send reminder</button>
                    <button type="button" className={appButtonSecondaryClassName}>Edit worker</button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {activeTab === "audit" ? (
            <EmptyState title="No audit log entries available" description="This drawer is using workforce and training matrix data only. Detailed audit events will appear here when an audit source is connected." align="left" />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{cleanText(value, "Not set")}</p>
    </div>
  );
}

function AccessFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{cleanText(value, "Not set")}</p>
    </div>
  );
}
