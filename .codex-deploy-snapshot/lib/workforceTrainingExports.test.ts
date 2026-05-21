import { describe, expect, it } from "vitest";
import { buildWorkforceTrainingExport, workforceTrainingExportOptions, type WorkforceTrainingExportRow } from "./workforceTrainingExports";

const rows: WorkforceTrainingExportRow[] = [
  {
    userId: "worker-1",
    name: "Jack Jane",
    workerType: "Employee",
    loginAccessStatus: "Active User",
    companyOrDepartment: "Operations",
    jobTitleOrTrade: "Foreman",
    assignedJobsites: ["Hillcrest"],
    supervisorOrManager: "Sarah Lee",
    readinessStatus: "Restricted",
    trainingStatus: "Restricted",
    permitExposureStatus: "Permit-linked gaps",
    accessStatus: "Active User",
    lastUpdated: "Profile current",
    trainingSummary: {
      requiredCount: 2,
      completeCount: 1,
      missingCount: 0,
      expiringSoonCount: 0,
      overdueCount: 1,
      permitLinkedGaps: 1,
      overallStatus: "Restricted",
      nextDueDate: "2026-05-01",
    },
    trainingRequirements: [
      {
        requirementId: "hot-work",
        trainingName: "Hot Work Training",
        requiredBecause: "Permit exposure, Site requirement",
        requirementSources: ["Permit exposure", "Site requirement"],
        status: "Expired",
        completedDate: null,
        expiryDate: "2026-05-01",
        dueDate: "2026-05-01",
        evidenceStatus: "Missing evidence",
        trainerOrApprover: "Not recorded",
        courseVersion: "Current",
        preventionMessage: "Worker is restricted from permit-controlled activity until Hot Work Training is current.",
      },
      {
        requirementId: "orientation",
        trainingName: "Company Orientation",
        requiredBecause: "Company policy",
        requirementSources: ["Company policy"],
        status: "Complete",
        completedDate: "On file",
        expiryDate: null,
        dueDate: null,
        evidenceStatus: "On file",
        trainerOrApprover: "Safety team",
        courseVersion: "Current",
        preventionMessage: null,
      },
    ],
  },
  {
    userId: "tracked:worker-2",
    name: "Mark Smith",
    workerType: "Contractor",
    loginAccessStatus: "No Portal Access",
    companyOrDepartment: "ABC Electrical",
    jobTitleOrTrade: "Electrician",
    assignedJobsites: ["Hillcrest"],
    readinessStatus: "Ready",
    trainingStatus: "Ready",
    permitExposureStatus: "No permit-linked training gaps found",
    accessStatus: "Restricted",
    trainingRequirements: [],
  },
];

describe("workforce training exports", () => {
  it("exposes all requested report export options", () => {
    expect(workforceTrainingExportOptions.map((option) => option.type)).toEqual([
      "full_workforce",
      "training_matrix_by_worker",
      "training_matrix_by_course",
      "overdue_training",
      "expiring_soon",
      "contractor_readiness",
      "jobsite_readiness",
      "permit_linked_gaps",
      "missing_evidence",
    ]);
  });

  it("exports the full workforce list without raw None labels", () => {
    const report = buildWorkforceTrainingExport("full_workforce", rows);

    expect(report.filename).toContain("full-workforce-list");
    expect(report.content).toContain('"Jack Jane"');
    expect(report.content).toContain('"No Portal Access"');
    expect(report.content).not.toContain('"None"');
  });

  it("exports permit-linked gaps with prevention messages", () => {
    const report = buildWorkforceTrainingExport("permit_linked_gaps", rows);

    expect(report.content).toContain('"Hot Work Training"');
    expect(report.content).toContain('"Permit exposure, Site requirement"');
    expect(report.content).toContain('"Worker is restricted from permit-controlled activity');
    expect(report.content).not.toContain('"Company Orientation"');
  });

  it("exports course rollups", () => {
    const report = buildWorkforceTrainingExport("training_matrix_by_course", rows);

    expect(report.content).toContain('"Training course","Required workers","Complete","Missing","Expiring soon","Overdue","Permit-linked gaps","Evidence missing"');
    expect(report.content).toContain('"Hot Work Training","1","0","0","0","1","1","1"');
  });
});
