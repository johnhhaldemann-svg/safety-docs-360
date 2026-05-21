import type { Stage1TrainingDetail, Stage1TrainingSummary } from "@/lib/trainingMatrixStage1";

export type WorkforceTrainingExportType =
  | "full_workforce"
  | "training_matrix_by_worker"
  | "training_matrix_by_course"
  | "overdue_training"
  | "expiring_soon"
  | "contractor_readiness"
  | "jobsite_readiness"
  | "permit_linked_gaps"
  | "missing_evidence";

export type WorkforceTrainingExportRow = {
  userId: string;
  name: string;
  workerType?: string | null;
  loginAccessStatus?: string | null;
  companyOrDepartment?: string | null;
  jobTitleOrTrade?: string | null;
  assignedJobsites?: string[] | null;
  supervisorOrManager?: string | null;
  readinessStatus?: string | null;
  trainingStatus?: string | null;
  permitExposureStatus?: string | null;
  accessStatus?: string | null;
  lastUpdated?: string | null;
  trainingRequirements?: Stage1TrainingDetail[] | null;
  trainingSummary?: Stage1TrainingSummary | null;
};

export const workforceTrainingExportOptions: Array<{ type: WorkforceTrainingExportType; label: string; description: string }> = [
  { type: "full_workforce", label: "Full workforce list", description: "People directory with readiness and access status." },
  { type: "training_matrix_by_worker", label: "Training matrix by worker", description: "Worker-level training counts and next due dates." },
  { type: "training_matrix_by_course", label: "Training matrix by course", description: "Course rollup across required workers." },
  { type: "overdue_training", label: "Overdue training report", description: "Expired and overdue training requirements." },
  { type: "expiring_soon", label: "Expiring soon report", description: "Training requirements flagged as expiring soon." },
  { type: "contractor_readiness", label: "Contractor readiness report", description: "Contractor and external worker readiness." },
  { type: "jobsite_readiness", label: "Jobsite readiness report", description: "Readiness grouped by assigned jobsite." },
  { type: "permit_linked_gaps", label: "Permit-linked training gaps", description: "Permit-critical gaps and prevention messages." },
  { type: "missing_evidence", label: "Evidence missing report", description: "Requirements without visible evidence." },
];

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function fileSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function jobsiteList(row: WorkforceTrainingExportRow) {
  return row.assignedJobsites?.length ? row.assignedJobsites : ["No jobsite assigned"];
}

function isContractor(row: WorkforceTrainingExportRow) {
  const workerType = String(row.workerType ?? "").toLowerCase();
  return workerType.includes("contractor") || workerType.includes("external") || row.loginAccessStatus === "No Portal Access";
}

function isPermitGap(detail: Stage1TrainingDetail) {
  return detail.requirementSources.includes("Permit exposure") && ["Missing", "Expired", "Overdue"].includes(detail.status);
}

function rowsForRequirement(
  rows: WorkforceTrainingExportRow[],
  predicate: (detail: Stage1TrainingDetail, row: WorkforceTrainingExportRow) => boolean
) {
  return rows.flatMap((row) =>
    (row.trainingRequirements ?? [])
      .filter((detail) => predicate(detail, row))
      .map((detail) => [row.name, row.workerType, row.loginAccessStatus, row.companyOrDepartment, jobsiteList(row).join(", "), detail.trainingName, detail.requiredBecause, detail.status, detail.dueDate ?? "", detail.expiryDate ?? "", detail.evidenceStatus, detail.preventionMessage ?? ""])
  );
}

export function buildWorkforceTrainingExport(type: WorkforceTrainingExportType, rows: WorkforceTrainingExportRow[]) {
  const generatedAt = new Date().toISOString().slice(0, 10);
  const option = workforceTrainingExportOptions.find((item) => item.type === type);
  const label = option?.label ?? type;
  const filename = `${fileSafe(label)}-${generatedAt}.csv`;

  if (type === "full_workforce") {
    return {
      filename,
      content: csv(
        ["Name", "Worker type", "Login access", "Company / department", "Job title / trade", "Assigned jobsite", "Supervisor / manager", "Readiness status", "Training status", "Permit exposure", "Access status", "Last updated"],
        rows.map((row) => [row.name, row.workerType, row.loginAccessStatus, row.companyOrDepartment, row.jobTitleOrTrade, jobsiteList(row).join(", "), row.supervisorOrManager, row.readinessStatus, row.trainingStatus, row.permitExposureStatus, row.accessStatus, row.lastUpdated])
      ),
    };
  }

  if (type === "training_matrix_by_worker") {
    return {
      filename,
      content: csv(
        ["Worker", "Worker type", "Login access", "Company / department", "Job title / trade", "Jobsite", "Supervisor / manager", "Required", "Complete", "Missing", "Expiring soon", "Overdue", "Permit-linked gaps", "Overall status", "Next due date"],
        rows.map((row) => [row.name, row.workerType, row.loginAccessStatus, row.companyOrDepartment, row.jobTitleOrTrade, jobsiteList(row).join(", "), row.supervisorOrManager, row.trainingSummary?.requiredCount ?? 0, row.trainingSummary?.completeCount ?? 0, row.trainingSummary?.missingCount ?? 0, row.trainingSummary?.expiringSoonCount ?? 0, row.trainingSummary?.overdueCount ?? 0, row.trainingSummary?.permitLinkedGaps ?? 0, row.trainingSummary?.overallStatus ?? row.trainingStatus ?? "", row.trainingSummary?.nextDueDate ?? ""]),
      ),
    };
  }

  if (type === "training_matrix_by_course") {
    const courseMap = new Map<string, Stage1TrainingDetail[]>();
    for (const row of rows) {
      for (const detail of row.trainingRequirements ?? []) {
        const list = courseMap.get(detail.trainingName) ?? [];
        list.push(detail);
        courseMap.set(detail.trainingName, list);
      }
    }
    return {
      filename,
      content: csv(
        ["Training course", "Required workers", "Complete", "Missing", "Expiring soon", "Overdue", "Permit-linked gaps", "Evidence missing"],
        Array.from(courseMap.entries()).map(([course, details]) => [
          course,
          details.filter((detail) => detail.status !== "Not Applicable").length,
          details.filter((detail) => detail.status === "Complete").length,
          details.filter((detail) => detail.status === "Missing").length,
          details.filter((detail) => detail.status === "Expiring Soon").length,
          details.filter((detail) => detail.status === "Overdue" || detail.status === "Expired").length,
          details.filter(isPermitGap).length,
          details.filter((detail) => detail.evidenceStatus === "Missing evidence").length,
        ])
      ),
    };
  }

  if (type === "contractor_readiness") {
    return {
      filename,
      content: csv(
        ["Name", "Worker type", "Login access", "Company / department", "Job title / trade", "Jobsite", "Readiness", "Training", "Permit exposure", "Access"],
        rows.filter(isContractor).map((row) => [row.name, row.workerType, row.loginAccessStatus, row.companyOrDepartment, row.jobTitleOrTrade, jobsiteList(row).join(", "), row.readinessStatus, row.trainingStatus, row.permitExposureStatus, row.accessStatus])
      ),
    };
  }

  if (type === "jobsite_readiness") {
    const grouped = new Map<string, WorkforceTrainingExportRow[]>();
    for (const row of rows) {
      for (const jobsite of jobsiteList(row)) {
        const list = grouped.get(jobsite) ?? [];
        list.push(row);
        grouped.set(jobsite, list);
      }
    }
    return {
      filename,
      content: csv(
        ["Jobsite", "Workers", "Ready", "Ready with warnings", "Not ready / restricted", "Permit-linked gaps", "No portal access"],
        Array.from(grouped.entries()).map(([jobsite, list]) => [
          jobsite,
          list.length,
          list.filter((row) => row.readinessStatus === "Ready").length,
          list.filter((row) => row.readinessStatus === "Ready With Warnings").length,
          list.filter((row) => ["Not Ready", "Restricted", "Blocked"].includes(String(row.readinessStatus))).length,
          list.reduce((sum, row) => sum + (row.trainingSummary?.permitLinkedGaps ?? 0), 0),
          list.filter((row) => row.loginAccessStatus === "No Portal Access").length,
        ])
      ),
    };
  }

  const predicate =
    type === "overdue_training"
      ? (detail: Stage1TrainingDetail) => detail.status === "Overdue" || detail.status === "Expired"
      : type === "expiring_soon"
        ? (detail: Stage1TrainingDetail) => detail.status === "Expiring Soon"
        : type === "permit_linked_gaps"
          ? isPermitGap
          : (detail: Stage1TrainingDetail) => detail.evidenceStatus === "Missing evidence";

  return {
    filename,
    content: csv(
      ["Worker", "Worker type", "Login access", "Company / department", "Jobsite", "Training course", "Required because", "Status", "Due date", "Expiry date", "Evidence", "Prevention message"],
      rowsForRequirement(rows, predicate)
    ),
  };
}
