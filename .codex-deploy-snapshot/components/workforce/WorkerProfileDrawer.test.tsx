import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  WorkerProfileDrawer,
  buildWorkerProfileFromDirectoryRow,
  buildWorkerProfileFromMatrixRow,
  mergeWorkerProfiles,
  type WorkerProfileRecord,
  type WorkerProfileTab,
} from "./WorkerProfileDrawer";

const baseTrainingDetail = {
  requirementId: "hot-work",
  trainingName: "Hot Work Training",
  requiredBecause: "Permit exposure, Site requirement",
  requirementSources: ["Permit exposure" as const, "Site requirement" as const],
  status: "Expired" as const,
  completedDate: null,
  expiryDate: "2026-05-01",
  dueDate: "2026-05-01",
  evidenceStatus: "Missing evidence",
  trainerOrApprover: "Not recorded",
  courseVersion: "Current",
  preventionMessage: "Worker is restricted from permit-controlled activity until Hot Work Training is current.",
};

const completedEvidenceDetail = {
  ...baseTrainingDetail,
  requirementId: "fall-protection",
  trainingName: "Fall Protection Training",
  requiredBecause: "Site requirement",
  requirementSources: ["Site requirement" as const],
  status: "Complete" as const,
  completedDate: "On file",
  expiryDate: "2026-12-31",
  dueDate: null,
  evidenceStatus: "On file",
  preventionMessage: null,
};

function renderDrawer(profile: WorkerProfileRecord, activeTab: WorkerProfileTab = "summary") {
  return renderToStaticMarkup(
    <WorkerProfileDrawer
      profile={profile}
      activeTab={activeTab}
      onTabChange={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

describe("WorkerProfileDrawer", () => {
  it("renders system user header and access details", () => {
    const profile = buildWorkerProfileFromMatrixRow({
      userId: "user-1",
      name: "Jack Jane",
      email: "jack@example.com",
      role: "Company Admin",
      status: "Active",
      workerType: "Employee",
      loginAccessStatus: "Active User",
      companyOrDepartment: "TJ Contracting",
      jobTitleOrTrade: "Company Admin",
      assignedJobsites: ["Hillcrest Office Fit-Out"],
      supervisorOrManager: "Sarah Lee",
      readinessStatus: "Ready",
      trainingStatus: "Ready",
      permitExposureStatus: "No permit-linked training gaps found",
      accessStatus: "Active User",
      lastUpdated: "Profile current",
      trainingRequirements: [],
    });
    const html = renderDrawer(profile, "access");

    expect(html).toContain("Jack Jane");
    expect(html).toContain("Employee");
    expect(html).toContain("Active User");
    expect(html).toContain("Login email");
    expect(html).toContain("jack@example.com");
    expect(html).not.toContain("Convert to system user");
  });

  it("renders no-portal tracked worker access without login controls", () => {
    const profile = buildWorkerProfileFromDirectoryRow({
      id: "tracked-1",
      source: "tracked",
      name: "Mark Smith",
      email: "mark@example.com",
      role: "Electrician",
      status: "active",
      workerType: "Contractor",
      loginAccess: "No Portal Access",
      companyOrDepartment: "ABC Electrical",
      jobTitleOrTrade: "Electrician",
      assignedJobsite: "Hillcrest Office Fit-Out",
      supervisorOrManager: "Sarah Lee",
      readinessStatus: "Not Ready",
      trainingStatus: "Missing",
      permitExposure: "Permit-linked gaps",
      lastUpdated: "Updated recently",
    });
    const html = renderDrawer(profile, "access");

    expect(html).toContain("Mark Smith");
    expect(html).toContain("No Portal Access");
    expect(html).toContain("Responsible manager / sponsor");
    expect(html).toContain("Convert to system user");
    expect(html).not.toContain("Login email");
  });

  it("shows permit prevention messages and avoids None empty labels", () => {
    const profile = buildWorkerProfileFromMatrixRow({
      userId: "tracked:worker-1",
      personType: "tracked_employee",
      name: "Ari Permit",
      workerType: "External Worker",
      loginAccessStatus: "No Portal Access",
      companyOrDepartment: "Tracked workforce",
      jobTitleOrTrade: "Welder",
      assignedJobsites: ["Hillcrest"],
      supervisorOrManager: "Safety Manager",
      readinessStatus: "Restricted",
      trainingStatus: "Restricted",
      permitExposureStatus: "Permit-linked gaps",
      accessStatus: "Restricted",
      trainingRequirements: [baseTrainingDetail, completedEvidenceDetail],
      trainingSummary: {
        requiredCount: 1,
        completeCount: 0,
        missingCount: 0,
        expiringSoonCount: 0,
        overdueCount: 1,
        permitLinkedGaps: 1,
        overallStatus: "Restricted",
        nextDueDate: "2026-05-01",
      },
    });
    const html = renderDrawer(profile, "permits");

    expect(html).toContain("Hot Work Training");
    expect(html).toContain("Worker is restricted from permit-controlled activity");
    expect(html).not.toContain(">None<");
  });

  it("merges directory labels with matrix training details", () => {
    const directory = buildWorkerProfileFromDirectoryRow({
      id: "user-1",
      source: "user",
      name: "Directory Name",
      loginAccess: "Active User",
      workerType: "Employee",
      companyOrDepartment: "Operations",
      jobTitleOrTrade: "Foreman",
      assignedJobsite: "North Yard",
      supervisorOrManager: "Site Lead",
      readinessStatus: "Ready",
      trainingStatus: "Ready",
      permitExposure: "No permit-linked training gaps found",
      lastUpdated: "Recently",
    });
    const matrix = buildWorkerProfileFromMatrixRow({
      userId: "user-1",
      name: "Matrix Name",
      trainingRequirements: [baseTrainingDetail],
    });
    const merged = mergeWorkerProfiles(directory, matrix);

    expect(merged?.name).toBe("Directory Name");
    expect(merged?.trainingRequirements).toHaveLength(1);
  });

  it("renders all worker profile tab content", () => {
    const profile = buildWorkerProfileFromMatrixRow({
      userId: "worker-tabs",
      name: "Taylor Tabs",
      email: "taylor@example.com",
      loginAccessStatus: "Active User",
      jobTitleOrTrade: "Electrician",
      assignedJobsites: ["Hillcrest Office Fit-Out"],
      readinessStatus: "Ready With Warnings",
      trainingStatus: "Expiring Soon",
      permitExposureStatus: "Permit-linked gaps",
      accessStatus: "Active User",
      trainingRequirements: [baseTrainingDetail, completedEvidenceDetail],
      trainingSummary: {
        requiredCount: 1,
        completeCount: 0,
        missingCount: 0,
        expiringSoonCount: 0,
        overdueCount: 1,
        permitLinkedGaps: 1,
        overallStatus: "Ready With Warnings",
        nextDueDate: "2026-05-01",
      },
    });

    expect(renderDrawer(profile, "summary")).toContain("Overall readiness");
    expect(renderDrawer(profile, "training")).toContain("Training name");
    expect(renderDrawer(profile, "permits")).toContain("Required because: Permit exposure, Site requirement");
    expect(renderDrawer(profile, "jobsites")).toContain("Required site training");
    expect(renderDrawer(profile, "documents")).toContain("Fall Protection Training evidence");
    expect(renderDrawer(profile, "actions")).toContain("Worker is restricted from permit-controlled activity");
    expect(renderDrawer(profile, "access")).toContain("Login email");
    expect(renderDrawer(profile, "audit")).toContain("No Audit Log Entries Available");
  });
});
