import {
  keywordMatchesHaystack,
  normalizeForMatch,
  type TrainingMatrixCellDetail,
  type TrainingMatrixCellState,
} from "@/lib/trainingMatrix";
import type { CertificationInventoryItem } from "@/lib/certificationExpirations";

export const DEFAULT_EXPIRING_SOON_DAYS = 30;

export type Stage1TrainingStatus =
  | "Complete"
  | "In Progress"
  | "Missing"
  | "Expiring Soon"
  | "Overdue"
  | "Expired"
  | "Awaiting Approval"
  | "Not Applicable";

export type Stage1ReadinessStatus =
  | "Ready"
  | "Ready With Warnings"
  | "Not Ready"
  | "Restricted"
  | "Blocked"
  | "Pending Review"
  | "Inactive";

export type Stage1RequirementReason =
  | "Role requirement"
  | "Site requirement"
  | "Permit exposure"
  | "Equipment requirement"
  | "Department requirement"
  | "Company policy"
  | "Supervisor role"
  | "Manually assigned";

export type Stage1RequirementLike = {
  id: string;
  title: string;
  matchKeywords?: string[] | null;
  applyTrades?: string[] | null;
  applyPositions?: string[] | null;
  applyDepartments?: string[] | null;
  applySubTrades?: string[] | null;
  applyTaskCodes?: string[] | null;
  generatedSourceType?: string | null;
};

export type Stage1WorkerProfileLike = {
  jobTitle?: string | null;
  tradeSpecialty?: string | null;
  companyOrDepartment?: string | null;
  workerType?: string | null;
  readinessStatus?: string | null;
  assignedJobsiteCount?: number | null;
};

export type Stage1TrainingDetail = {
  requirementId: string;
  trainingName: string;
  requiredBecause: string;
  requirementSources: Stage1RequirementReason[];
  status: Stage1TrainingStatus;
  completedDate: string | null;
  expiryDate: string | null;
  dueDate: string | null;
  evidenceStatus: string;
  trainerOrApprover: string;
  courseVersion: string;
  preventionMessage: string | null;
};

export type Stage1TrainingSummary = {
  requiredCount: number;
  completeCount: number;
  missingCount: number;
  expiringSoonCount: number;
  overdueCount: number;
  permitLinkedGaps: number;
  overallStatus: Stage1ReadinessStatus;
  nextDueDate: string | null;
};

function normalizedSet(values: string[] | null | undefined): Set<string> {
  return new Set((values ?? []).map(normalizeForMatch).filter(Boolean));
}

function includesAny(haystack: string, needles: string[]): boolean {
  const normalizedHaystack = normalizeForMatch(haystack);
  return needles.some((needle) => normalizedHaystack.includes(needle));
}

function setIncludesValue(values: Set<string>, value: string): boolean {
  return Boolean(value) && values.has(value);
}

function isCompanyPolicyRequirement(requirement: Stage1RequirementLike): boolean {
  const generated = normalizeForMatch(requirement.generatedSourceType ?? "");
  return (
    includesAny(requirement.title, ["company", "policy", "orientation", "induction", "all workers", "all positions"]) ||
    includesAny(generated, ["company", "policy", "orientation", "induction"])
  );
}

export function requirementSourcesForWorker(
  requirement: Stage1RequirementLike,
  worker: Stage1WorkerProfileLike
): Stage1RequirementReason[] {
  const sources: Stage1RequirementReason[] = [];
  const positions = normalizedSet(requirement.applyPositions);
  const trades = normalizedSet(requirement.applyTrades);
  const departments = normalizedSet(requirement.applyDepartments);
  const workerPosition = normalizeForMatch(worker.jobTitle ?? "");
  const workerTrade = normalizeForMatch(worker.tradeSpecialty ?? "");
  const workerDepartment = normalizeForMatch(worker.companyOrDepartment ?? "");
  const workerType = normalizeForMatch(worker.workerType ?? "");
  const title = requirement.title;
  const generated = normalizeForMatch(requirement.generatedSourceType ?? "");

  if (positions.size > 0 && setIncludesValue(positions, workerPosition)) {
    sources.push(workerPosition.includes("supervisor") || workerPosition.includes("foreman") ? "Supervisor role" : "Role requirement");
  }
  if (trades.size > 0 && setIncludesValue(trades, workerTrade)) {
    sources.push("Role requirement");
  }
  if (departments.size > 0 && setIncludesValue(departments, workerDepartment)) {
    sources.push("Department requirement");
  } else if (workerDepartment && includesAny(title, [workerDepartment])) {
    sources.push("Department requirement");
  }
  if ((requirement.applySubTrades?.length ?? 0) > 0 || (requirement.applyTaskCodes?.length ?? 0) > 0) {
    sources.push("Site requirement");
  }
  if (generated.includes("permit") || includesAny(title, ["permit", "hot work", "confined space", "loto"])) {
    sources.push("Permit exposure");
  }
  if (includesAny(title, ["equipment", "mewp", "aerial lift", "forklift", "crane", "rigging", "scissor lift"])) {
    sources.push("Equipment requirement");
  }
  if (worker.assignedJobsiteCount && worker.assignedJobsiteCount > 0 && (requirement.applySubTrades?.length ?? 0) > 0) {
    sources.push("Site requirement");
  }
  if (workerType && includesAny(title, [workerType])) {
    sources.push("Company policy");
  }
  if (sources.length === 0 && ((requirement.applyTrades?.length ?? 0) > 0 || (requirement.applyPositions?.length ?? 0) > 0)) {
    sources.push("Company policy");
  }
  if (sources.length === 0 && isCompanyPolicyRequirement(requirement)) {
    sources.push("Company policy");
  }
  if (sources.length === 0) {
    sources.push("Manually assigned");
  }

  return [...new Set(sources)];
}

function findExpiredMatchingCredential(
  requirement: Stage1RequirementLike,
  inventory: CertificationInventoryItem[]
): CertificationInventoryItem | null {
  const keywords = (requirement.matchKeywords ?? []).map(normalizeForMatch).filter(Boolean);
  if (keywords.length === 0) return null;
  return (
    inventory.find((credential) => {
      if (credential.expiryStatus !== "expired") return false;
      const cert = normalizeForMatch(credential.name);
      return keywords.some((keyword) => keywordMatchesHaystack(keyword, cert));
    }) ?? null
  );
}

export function stage1StatusForRequirement(params: {
  requirement: Stage1RequirementLike;
  state: TrainingMatrixCellState;
  detail?: TrainingMatrixCellDetail;
  inventory?: CertificationInventoryItem[];
  expiringSoonDays?: number;
}): Stage1TrainingStatus {
  if (params.state === "na") return "Not Applicable";
  const expiredCredential = findExpiredMatchingCredential(params.requirement, params.inventory ?? []);
  if (expiredCredential) return "Expired";
  if (params.state === "gap") return "Missing";
  const days = params.detail?.daysUntilExpiry;
  if (params.detail?.expiryStatus === "soon" && days != null && days <= (params.expiringSoonDays ?? DEFAULT_EXPIRING_SOON_DAYS)) {
    return "Expiring Soon";
  }
  return "Complete";
}

export function buildStage1TrainingDetail(params: {
  requirement: Stage1RequirementLike;
  state: TrainingMatrixCellState;
  detail?: TrainingMatrixCellDetail;
  worker: Stage1WorkerProfileLike;
  inventory?: CertificationInventoryItem[];
  expiringSoonDays?: number;
}): Stage1TrainingDetail {
  const status = stage1StatusForRequirement(params);
  const sources = requirementSourcesForWorker(params.requirement, params.worker);
  const expiryDate =
    params.detail?.expiresOn ??
    findExpiredMatchingCredential(params.requirement, params.inventory ?? [])?.expiresOn ??
    null;
  const blockingGap = ["Missing", "Expired", "Overdue"].includes(status);
  const permitLinkedGap = sources.includes("Permit exposure") && blockingGap;
  const equipmentGap = sources.includes("Equipment requirement") && blockingGap;
  const siteGap = sources.includes("Site requirement") && blockingGap;

  return {
    requirementId: params.requirement.id,
    trainingName: params.requirement.title,
    requiredBecause: sources.join(", "),
    requirementSources: sources,
    status,
    completedDate: status === "Complete" || status === "Expiring Soon" ? "On file" : null,
    expiryDate,
    dueDate: ["Missing", "Expired", "Overdue", "Expiring Soon"].includes(status) ? expiryDate : null,
    evidenceStatus: params.detail?.matchedLabel ? "On file" : status === "Not Applicable" ? "Not required" : "Missing evidence",
    trainerOrApprover: "Not recorded",
    courseVersion: "Current",
    preventionMessage: permitLinkedGap
      ? `Worker is restricted from permit-controlled activity until ${params.requirement.title} is current.`
      : equipmentGap
        ? `Worker can access site but cannot operate equipment tied to ${params.requirement.title} until training is current.`
        : siteGap
          ? `Worker is ready for general work but restricted from site-specific activity until ${params.requirement.title} is current.`
          : status === "Expiring Soon"
            ? `${params.requirement.title} is expiring soon; schedule renewal before the expiry date.`
            : null,
  };
}

function dueDateRank(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(`${value}T00:00:00.000Z`).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function summarizeStage1Training(details: Stage1TrainingDetail[]): Stage1TrainingSummary {
  const required = details.filter((detail) => detail.status !== "Not Applicable");
  const completeCount = required.filter((detail) => detail.status === "Complete").length;
  const expiringSoonCount = required.filter((detail) => detail.status === "Expiring Soon").length;
  const overdueCount = required.filter((detail) => detail.status === "Overdue" || detail.status === "Expired").length;
  const missingCount = required.filter((detail) => detail.status === "Missing").length;
  const permitLinkedGaps = required.filter(
    (detail) =>
      detail.requirementSources.includes("Permit exposure") &&
      ["Missing", "Expired", "Overdue"].includes(detail.status)
  ).length;
  const nextDueDate =
    required
      .map((detail) => detail.dueDate)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => dueDateRank(left) - dueDateRank(right))[0] ?? null;

  let overallStatus: Stage1ReadinessStatus = "Ready";
  if (permitLinkedGaps > 0) overallStatus = "Restricted";
  else if (missingCount > 0 || overdueCount > 0) overallStatus = "Not Ready";
  else if (expiringSoonCount > 0) overallStatus = "Ready With Warnings";

  return {
    requiredCount: required.length,
    completeCount,
    missingCount,
    expiringSoonCount,
    overdueCount,
    permitLinkedGaps,
    overallStatus,
    nextDueDate,
  };
}
