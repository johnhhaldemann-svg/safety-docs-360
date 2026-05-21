import { describe, expect, it } from "vitest";
import {
  buildSafePredictDataset,
  forecastConfidenceForSite,
  forecastReasonsForSite,
  hasSafePredictForecastInputs,
  jobsiteById,
  nextActionStatus,
  normalizeLiveActions,
  normalizeLiveDocuments,
  normalizeLiveJobsites,
  normalizeLivePermits,
  normalizeLiveUsers,
  safePredictStatusToApi,
  riskForecastForSite,
  siteScoped,
  siteIdFromLabel,
  summarizeSafePredictScope,
  summarizeSafePredictDataset,
} from "@/lib/safePredictData";
import { defaultPermitChecklistItems, isPermitFormComplete } from "@/lib/safePredictPermitForms";

describe("safePredictData", () => {
  it("normalizes live jobsites while preserving SafePredict risk fields", () => {
    const jobsites = normalizeLiveJobsites([
      {
        id: "live-site-1",
        name: "North Pier Expansion",
        project_number: "NP-100",
        location: "Houston, TX",
        status: "active",
        safety_lead: "Sam Rivera",
      },
    ]);

    expect(jobsites).toHaveLength(1);
    expect(jobsites[0]).toMatchObject({
      id: "live-site-1",
      name: "North Pier Expansion",
      code: "NP-100",
      status: "active",
      siteLead: "Sam Rivera",
    });
    expect(jobsites[0].riskScore).toBe(0);
  });

  it("builds a connected demo fallback dataset", () => {
    const dataset = buildSafePredictDataset();
    const summary = summarizeSafePredictDataset(dataset);

    expect(dataset.mode).toBe("demo");
    expect(dataset.jobsites.length).toBe(5);
    expect(siteScoped(dataset.actions, "plant-1").length).toBeGreaterThan(0);
    expect(siteScoped(dataset.permits, "riverside").length).toBeGreaterThan(0);
    expect(siteScoped(dataset.inspections, "warehouse-a").length).toBeGreaterThan(0);
    expect(summary.openActions).toBeGreaterThan(0);
    expect(summary.inspectionGaps).toBeGreaterThan(0);
  });

  it("keeps empty live workspaces live and tenant-clean", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { id: "co-live-1", name: "TJ Contracting", accountType: "Live workspace" },
      liveJobsites: [],
    });
    const summary = summarizeSafePredictDataset(dataset);

    expect(dataset.mode).toBe("live");
    expect(dataset.company).toMatchObject({ id: "co-live-1", name: "TJ Contracting" });
    expect(dataset.jobsites).toEqual([]);
    expect(dataset.actions).toEqual([]);
    expect(dataset.permits).toEqual([]);
    expect(dataset.events).toEqual([]);
    expect(dataset.hazards).toEqual([]);
    expect(hasSafePredictForecastInputs(dataset)).toBe(false);
    expect(riskForecastForSite(dataset, "all")).toEqual([]);
    expect(summary).toMatchObject({
      jobsites: 0,
      employees: 0,
      openActions: 0,
      activePermits: 0,
      riskScore: 0,
      inspectionGaps: 0,
      incidents: 0,
      observations: 0,
      hazards: 0,
    });
  });

  it("normalizes live jobsites without inheriting demo portfolio metadata", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "TJ Contracting" },
      liveJobsites: [{ id: "live-site-1", name: "Main Office Build", status: "active" }],
    });

    expect(dataset.mode).toBe("live");
    expect(dataset.jobsites).toHaveLength(1);
    expect(dataset.jobsites[0]).toMatchObject({
      id: "live-site-1",
      name: "Main Office Build",
      code: "Not set",
      address: "Not set",
      cityState: "Not set",
      phase: "Not set",
      siteLead: "Not set",
      customerName: "Not set",
      workforceCount: 0,
      openActions: 0,
      activePermits: 0,
      inspectionGaps: 0,
      incidentCount: 0,
      observationCount: 0,
    });
    expect(dataset.jobsites[0].name).not.toMatch(/Riverside|Plant|Warehouse/i);
    expect(dataset.jobsites[0].customerReportEmail).not.toContain("apex-demo");
  });

  it("normalizes live operational records into SafePredict pages", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors", accountType: "Live workspace" },
      liveJobsites: [{ id: "live-site-1", name: "North Pier Expansion", status: "active" }],
      liveActions: [{ id: "act-1", jobsite_id: "live-site-1", title: "Repair guardrail", status: "in_progress", severity: "high", category: "fall_hazard" }],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-site-1", title: "Near miss at stair tower", status: "open", severity: "high", incident_type: "near_miss" }],
      liveObservations: [{ id: "obs-1", jobsite_id: "live-site-1", title: "Material in walkway", status: "open", severity: "medium", category: "housekeeping" }],
      livePermits: [{ id: "permit-1", jobsite_id: "live-site-1", permit_type: "Hot Work", status: "expired" }],
      liveEmployees: [{ userId: "worker-1", name: "Sam Rivera", email: "sam.rivera@example.com", phone: "555-0101", role: "foreman", cells: ["compliant"], profileFields: { tradeSpecialty: "Steel", jobTitle: "Foreman" } }],
      liveUsers: [{ id: "worker-2", name: "Alicia Moore", role: "field_supervisor", status: "Active", jobsite_id: "live-site-1" }],
      liveInspections: [{ id: "audit-1", jobsite_id: "live-site-1", title: "Daily walk", status: "failed", failed_items: 2 }],
      liveReports: [{ id: "report-1", jobsite_id: "live-site-1", title: "Weekly risk summary", status: "published" }],
      liveDocuments: [{ id: "doc-1", jobsite_id: "live-site-1", title: "North Pier JSA", document_type: "JSA", status: "approved" }],
    });

    expect(dataset.mode).toBe("live");
    expect(dataset.company.name).toBe("Test Constructors");
    expect(dataset.company.accountType).toBe("Live workspace");
    expect(dataset.jobsites[0]).toMatchObject({ id: "live-site-1", name: "North Pier Expansion" });
    expect(siteScoped(dataset.actions, "live-site-1")[0]).toMatchObject({ title: "Repair guardrail", status: "In Progress", priority: "high" });
    expect(siteScoped(dataset.incidents, "live-site-1")[0]?.type).toBe("Near Miss");
    expect(siteScoped(dataset.observations, "live-site-1")[0]?.category).toBe("housekeeping");
    expect(siteScoped(dataset.permits, "live-site-1")[0]?.status).toBe("Expired");
    expect(siteScoped(dataset.inspections, "live-site-1")[0]?.status).toBe("Failed Check");
    expect(siteScoped(dataset.reports, "live-site-1")[0]?.status).toBe("Ready");
    expect(dataset.employees[0]).toMatchObject({ name: "Sam Rivera", email: "sam.rivera@example.com", phone: "555-0101", assignedSiteId: "live-site-1" });
    expect(dataset.employees.some((employee) => employee.name === "Alicia Moore")).toBe(true);
    expect(siteScoped(dataset.documents, "live-site-1")[0]).toMatchObject({ title: "North Pier JSA", type: "JSA", status: "Approved" });
    expect(hasSafePredictForecastInputs(dataset, "live-site-1")).toBe(true);
  });

  it("generates deterministic live forecasts from live workspace records", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [
        { id: "live-high", name: "High Risk Site", status: "active" },
        { id: "live-low", name: "Low Risk Site", status: "active" },
      ],
      liveActions: [
        { id: "act-1", jobsite_id: "live-high", title: "Repair guardrail", status: "in_progress", severity: "high" },
        { id: "act-2", jobsite_id: "live-high", title: "Close scaffold access gap", status: "open", severity: "critical" },
        { id: "act-3", jobsite_id: "live-low", title: "Closed paint touch-up", status: "verified_closed", severity: "low" },
      ],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-high", title: "Near miss at stair tower", status: "open", severity: "high" }],
      liveInspections: [{ id: "audit-1", jobsite_id: "live-high", title: "Daily walk", status: "failed", failed_items: 3 }],
    });

    const highForecast = riskForecastForSite(dataset, "live-high");
    const lowForecast = riskForecastForSite(dataset, "live-low");

    expect(highForecast).toHaveLength(10);
    expect(highForecast[0]).toMatchObject({ date: "Now" });
    expect(highForecast[0].predictedRisk).toBeGreaterThan(lowForecast[0]?.predictedRisk ?? -1);
    expect(new Set(highForecast.map((point) => point.predictedRisk)).size).toBeGreaterThan(1);
    expect(riskForecastForSite(dataset, "live-high")).toEqual(highForecast);
  });

  it("uses all jobsites for the company-wide forecast instead of the first project", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [
        { id: "live-low", name: "Low Risk First Site", status: "active" },
        { id: "live-high", name: "High Risk Second Site", status: "active" },
      ],
      liveActions: [
        { id: "act-low", jobsite_id: "live-low", title: "Closed paint touch-up", status: "verified_closed", severity: "low" },
        { id: "act-high", jobsite_id: "live-high", title: "Open fall exposure", status: "open", severity: "critical" },
      ],
      liveIncidents: [{ id: "inc-high", jobsite_id: "live-high", title: "Open near miss", status: "open", severity: "high" }],
      liveInspections: [{ id: "audit-high", jobsite_id: "live-high", title: "Failed daily walk", status: "failed", failed_items: 4 }],
    });

    const companyForecast = riskForecastForSite(dataset, "all");
    const firstProjectForecast = riskForecastForSite(dataset, "live-low");
    const highProjectForecast = riskForecastForSite(dataset, "live-high");

    expect(companyForecast).toHaveLength(10);
    expect(companyForecast[0].predictedRisk).toBeGreaterThan(firstProjectForecast[0]?.predictedRisk ?? -1);
    expect(companyForecast[0].predictedRisk).toBeLessThan(highProjectForecast[0]?.predictedRisk ?? 101);
    expect(companyForecast).not.toEqual(firstProjectForecast);
  });

  it("explains forecast points from the highest scoped open risk signals", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-site-1", name: "North Pier Expansion", status: "active" }],
      liveActions: [
        { id: "act-high", jobsite_id: "live-site-1", title: "Repair leading edge guardrail", status: "open", severity: "high", category: "fall_protection" },
        { id: "act-low", jobsite_id: "live-site-1", title: "Touch up sign paint", status: "open", severity: "low", category: "signage" },
      ],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-site-1", title: "Near miss at stair tower", status: "open", severity: "high", incident_type: "near_miss" }],
      livePermits: [{ id: "permit-1", jobsite_id: "live-site-1", permit_type: "Hot Work", title: "Hot work permit", status: "expired" }],
    });

    const [reason] = forecastReasonsForSite(dataset, "live-site-1", [{ date: "Now", predictedRisk: 82 }]);

    expect(reason.riskLevel).toBe("high");
    expect(reason.topDrivers[0]?.source).toBe("permits");
    expect(reason.topDrivers.map((driver) => driver.source)).toEqual(expect.arrayContaining(["incidents", "corrective_actions"]));
    expect(reason.topDrivers.map((driver) => driver.evidence).join(" ")).not.toContain("Touch up sign paint");
    expect(reason.nextAction).toContain("Review the top drivers today");
  });

  it("does not elevate closed or completed records in forecast reasons", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-site-1", name: "North Pier Expansion", status: "active" }],
      liveActions: [{ id: "act-1", jobsite_id: "live-site-1", title: "Closed guardrail repair", status: "verified_closed", severity: "critical" }],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-site-1", title: "Closed near miss", status: "closed", severity: "high" }],
      liveInspections: [{ id: "audit-1", jobsite_id: "live-site-1", title: "Daily walk", status: "completed", failed_items: 0 }],
    });

    const [reason] = forecastReasonsForSite(dataset, "live-site-1", [{ date: "Now", predictedRisk: 20 }]);

    expect(reason.topDrivers).toEqual([]);
    expect(reason.missingDataNote).toContain("No connected corrective actions");
  });

  it("returns a conservative missing-data reason for empty live scopes", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-empty", name: "Empty Site", status: "active" }],
    });

    const [reason] = forecastReasonsForSite(dataset, "live-empty", [{ date: "Now", predictedRisk: 45 }]);

    expect(reason.riskLevel).toBe("medium");
    expect(reason.topDrivers).toEqual([]);
    expect(reason.headline).toContain("limited connected signal data");
    expect(reason.missingDataNote).toContain("No connected corrective actions");
  });

  it("aggregates forecast reasons across all selected sites", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [
        { id: "live-a", name: "Low Site", status: "active" },
        { id: "live-b", name: "High Site", status: "active" },
      ],
      liveActions: [
        { id: "act-low", jobsite_id: "live-a", title: "Closed paint action", status: "verified_closed", severity: "low" },
        { id: "act-high", jobsite_id: "live-b", title: "Open fall exposure", status: "open", severity: "critical", category: "fall_protection" },
      ],
    });

    const [reason] = forecastReasonsForSite(dataset, "all", [{ date: "Now", predictedRisk: 91 }]);

    expect(reason.riskLevel).toBe("critical");
    expect(reason.topDrivers[0]).toMatchObject({ source: "corrective_actions" });
    expect(reason.evidence.join(" ")).toContain("Open fall exposure");
    expect(reason.nextAction).toContain("Immediate safety review");
  });

  it("derives model confidence from scoped live signal coverage", () => {
    const sparseDataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-sparse", name: "Sparse Site", status: "active" }],
      liveActions: [{ id: "act-1", jobsite_id: "live-sparse", title: "Repair guardrail", status: "open", severity: "medium" }],
    });
    const connectedDataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-connected", name: "Connected Site", status: "active" }],
      liveActions: [{ id: "act-1", jobsite_id: "live-connected", title: "Repair guardrail", status: "open", severity: "high" }],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-connected", title: "Near miss", status: "open", severity: "high" }],
      liveObservations: [{ id: "obs-1", jobsite_id: "live-connected", title: "Blocked access", status: "open", severity: "medium" }],
      livePermits: [{ id: "permit-1", jobsite_id: "live-connected", permit_type: "Hot Work", status: "active" }],
      liveEmployees: [{ userId: "worker-1", name: "Sam Rivera", cells: ["compliant"] }],
      liveInspections: [{ id: "audit-1", jobsite_id: "live-connected", title: "Daily walk", status: "failed", failed_items: 2 }],
    });

    const sparse = forecastConfidenceForSite(sparseDataset, "live-sparse");
    const connected = forecastConfidenceForSite(connectedDataset, "live-connected");

    expect(sparse.percent).not.toBe(87);
    expect(connected.percent).toBeGreaterThan(sparse.percent);
    expect(connected.sourceCount).toBeGreaterThan(sparse.sourceCount);
    expect(connected.detail).toContain("source type");
  });

  it("narrows confidence and forecast drivers when a project is selected", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [
        { id: "live-a", name: "Fall Exposure Site", status: "active" },
        { id: "live-b", name: "Permit Exposure Site", status: "active" },
      ],
      liveActions: [
        { id: "act-a", jobsite_id: "live-a", title: "Open leading edge", status: "open", severity: "critical", category: "fall_protection" },
        { id: "act-b", jobsite_id: "live-b", title: "Open hot work review", status: "open", severity: "medium", category: "hot_work" },
      ],
      livePermits: [{ id: "permit-b", jobsite_id: "live-b", permit_type: "Hot Work", title: "Hot work permit", status: "expired" }],
      liveEmployees: [
        { userId: "worker-a", name: "Sam Rivera", jobsite_id: "live-a", cells: ["gap"] },
        { userId: "worker-b", name: "Alicia Moore", jobsite_id: "live-b", cells: ["compliant"] },
      ],
    });

    const companyConfidence = forecastConfidenceForSite(dataset, "all");
    const projectConfidence = forecastConfidenceForSite(dataset, "live-a");
    const [companyReason] = forecastReasonsForSite(dataset, "all", [{ date: "Now", predictedRisk: 90 }]);
    const [projectReason] = forecastReasonsForSite(dataset, "live-a", [{ date: "Now", predictedRisk: 90 }]);

    expect(companyConfidence.signalCount).toBeGreaterThan(projectConfidence.signalCount);
    expect(companyReason.topDrivers.map((driver) => driver.evidence).join(" ")).toContain("Hot work permit");
    expect(projectReason.topDrivers.map((driver) => driver.evidence).join(" ")).toContain("Open leading edge");
    expect(projectReason.topDrivers.map((driver) => driver.evidence).join(" ")).not.toContain("Hot work permit");
  });

  it("returns low confidence when the selected live scope has no forecast inputs", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-empty", name: "Empty Site", status: "active" }],
    });

    expect(forecastConfidenceForSite(dataset, "live-empty")).toMatchObject({
      percent: 0,
      label: "Low",
      sourceCount: 0,
      signalCount: 0,
    });
  });

  it("returns low confidence for an empty company-wide live scope", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [
        { id: "live-empty-a", name: "Empty Site A", status: "active" },
        { id: "live-empty-b", name: "Empty Site B", status: "active" },
      ],
    });

    expect(hasSafePredictForecastInputs(dataset, "all")).toBe(false);
    expect(riskForecastForSite(dataset, "all")).toEqual([]);
    expect(forecastConfidenceForSite(dataset, "all")).toMatchObject({
      percent: 0,
      label: "Low",
      sourceCount: 0,
      signalCount: 0,
    });
  });

  it("keeps dense high-risk live forecasts varied instead of pinned at 100", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-heavy", name: "Heavy Signal Site", status: "active" }],
      liveActions: Array.from({ length: 10 }, (_, index) => ({
        id: `act-${index}`,
        jobsite_id: "live-heavy",
        title: `Critical action ${index}`,
        status: index % 2 === 0 ? "in_progress" : "open",
        severity: index % 3 === 0 ? "critical" : "high",
      })),
      liveIncidents: Array.from({ length: 5 }, (_, index) => ({
        id: `inc-${index}`,
        jobsite_id: "live-heavy",
        title: `High potential incident ${index}`,
        status: "open",
        severity: "critical",
      })),
      liveObservations: Array.from({ length: 8 }, (_, index) => ({
        id: `obs-${index}`,
        jobsite_id: "live-heavy",
        title: `High risk observation ${index}`,
        status: "open",
        severity: "high",
      })),
      livePermits: Array.from({ length: 4 }, (_, index) => ({
        id: `permit-${index}`,
        jobsite_id: "live-heavy",
        permit_type: "Hot Work",
        status: "expired",
      })),
      liveInspections: Array.from({ length: 4 }, (_, index) => ({
        id: `audit-${index}`,
        jobsite_id: "live-heavy",
        title: `Failed walk ${index}`,
        status: "failed",
        failed_items: 5,
      })),
    });

    const forecast = riskForecastForSite(dataset, "live-heavy");

    expect(forecast).toHaveLength(10);
    expect(forecast.some((point) => point.predictedRisk < 100)).toBe(true);
    expect(new Set(forecast.map((point) => point.predictedRisk)).size).toBeGreaterThan(1);
  });

  it("reduces live score pressure for closed and corrected records", () => {
    const openDataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-site-1", name: "North Pier Expansion", status: "active" }],
      liveActions: [
        { id: "act-1", jobsite_id: "live-site-1", title: "Repair guardrail", status: "in_progress", severity: "high" },
        { id: "act-2", jobsite_id: "live-site-1", title: "Replace scaffold access", status: "open", severity: "critical" },
      ],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-site-1", title: "Near miss at stair tower", status: "open", severity: "high" }],
      liveObservations: [{ id: "obs-1", jobsite_id: "live-site-1", title: "Material in walkway", status: "open", severity: "medium" }],
    });
    const closedDataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [{ id: "live-site-1", name: "North Pier Expansion", status: "active" }],
      liveActions: [
        { id: "act-1", jobsite_id: "live-site-1", title: "Repair guardrail", status: "verified_closed", severity: "high" },
        { id: "act-2", jobsite_id: "live-site-1", title: "Replace scaffold access", status: "corrected", severity: "critical" },
      ],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-site-1", title: "Near miss at stair tower", status: "closed", severity: "high" }],
      liveObservations: [{ id: "obs-1", jobsite_id: "live-site-1", title: "Material in walkway", status: "closed", severity: "medium" }],
    });

    expect(openDataset.jobsites[0].riskScore).toBeGreaterThan(closedDataset.jobsites[0].riskScore);
    expect(riskForecastForSite(openDataset, "live-site-1")[0].predictedRisk).toBeGreaterThan(
      riskForecastForSite(closedDataset, "live-site-1")[0].predictedRisk
    );
  });

  it("summarizes filtered SafePredict scopes by visible site ids", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors" },
      liveJobsites: [
        { id: "live-high", name: "High Risk Site", status: "active" },
        { id: "live-low", name: "Low Risk Site", status: "active" },
      ],
      liveActions: [
        { id: "act-1", jobsite_id: "live-high", title: "Repair guardrail", status: "in_progress", severity: "high" },
        { id: "act-2", jobsite_id: "live-low", title: "Paint final rail", status: "verified_closed", severity: "low" },
      ],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-high", title: "Near miss at stair tower", status: "open", severity: "high" }],
    });

    const high = summarizeSafePredictScope(dataset, ["live-high"]);
    const low = summarizeSafePredictScope(dataset, ["live-low"]);

    expect(high.jobsites).toBe(1);
    expect(high.openActions).toBe(1);
    expect(high.riskScore).toBeGreaterThan(low.riskScore);
    expect(low.openActions).toBe(0);
  });

  it("builds type-specific permit checklist defaults", () => {
    expect(defaultPermitChecklistItems("Hot Work Permit").map((item) => item.label).join(" ")).toContain("Fire watch");
    expect(defaultPermitChecklistItems("LOTO Permit").map((item) => item.label).join(" ")).toContain("Energy sources");
    expect(defaultPermitChecklistItems("Lift Plan").map((item) => item.label).join(" ")).toContain("Lift plan");
  });

  it("normalizes live permit checklist and acknowledgement metadata", () => {
    const jobsites = normalizeLiveJobsites([{ id: "live-site-1", name: "North Pier Expansion" }]);
    const [permit] = normalizeLivePermits([
      {
        id: "permit-1",
        jobsite_id: "live-site-1",
        permit_type: "Hot Work",
        title: "Level 3 hot work permit",
        status: "active",
        source_metadata: {
          permit_form_v1: {
            checklistItems: defaultPermitChecklistItems("Hot Work").map((item) => ({ ...item, checked: true })),
            acknowledgement: {
              acknowledged: true,
              name: "Jack Jane",
              acknowledgedAt: "2026-05-20T12:00:00.000Z",
              statement: "I acknowledge the permit checklist has been reviewed.",
            },
            notes: "Fire watch assigned.",
          },
        },
      },
    ], jobsites);

    expect(permit.title).toBe("Level 3 hot work permit");
    expect(permit.readiness).toBe("Ready");
    expect(isPermitFormComplete(permit.permitForm)).toBe(true);
    expect(permit.permitForm.acknowledgement.name).toBe("Jack Jane");
  });

  it("maps SafePredict action status changes to existing API statuses", () => {
    expect(safePredictStatusToApi("New")).toBe("open");
    expect(safePredictStatusToApi("In Progress")).toBe("in_progress");
    expect(safePredictStatusToApi("Awaiting Verification")).toBe("corrected");
    expect(safePredictStatusToApi("Closed")).toBe("verified_closed");
  });

  it("keeps standalone live action normalization jobsite-scoped", () => {
    const jobsites = normalizeLiveJobsites([{ id: "live-site-1", name: "North Pier Expansion" }]);
    const actions = normalizeLiveActions([{ id: "act-1", jobsite_id: "live-site-1", title: "Install barricade", status: "verified_closed" }], jobsites);

    expect(actions[0]).toMatchObject({ siteId: "live-site-1", status: "Closed" });
  });

  it("normalizes old users and files into SafePredict-native records", () => {
    const jobsites = normalizeLiveJobsites([{ id: "live-site-1", name: "North Pier Expansion" }]);

    expect(
      normalizeLiveUsers([{ id: "user-1", name: "Jordan Blake", role: "safety_manager", status: "Active", jobsite_id: "live-site-1" }], jobsites)[0]
    ).toMatchObject({ id: "user-1", name: "Jordan Blake", assignedSiteId: "live-site-1", status: "compliant" });

    expect(
      normalizeLiveDocuments([{ id: "doc-1", title: "Hot work permit packet", document_type: "Permit", status: "final", jobsite_id: "live-site-1" }], jobsites)[0]
    ).toMatchObject({ id: "doc-1", type: "Permit", status: "Approved", siteId: "live-site-1" });
  });

  it("keeps jobsite routing and forecast helpers deterministic", () => {
    const dataset = buildSafePredictDataset();

    expect(siteIdFromLabel("Plant 1")).toBe("plant-1");
    expect(jobsiteById(dataset, "warehouse-a")?.name).toContain("Warehouse A");
    expect(riskForecastForSite(dataset, "plant-1")[0]).toMatchObject({ historicalRisk: 50, predictedRisk: 50 });
    expect(riskForecastForSite(dataset, "warehouse-a")[0].predictedRisk).toBeGreaterThan(
      riskForecastForSite(dataset, "warehouse-b")[0].predictedRisk
    );
  });

  it("advances corrective action status in workflow order", () => {
    expect(nextActionStatus("New")).toBe("In Progress");
    expect(nextActionStatus("In Progress")).toBe("Awaiting Verification");
    expect(nextActionStatus("Awaiting Verification")).toBe("Closed");
    expect(nextActionStatus("Closed")).toBe("Closed");
  });
});
