import { describe, expect, it } from "vitest";
import {
  buildSafePredictDataset,
  jobsiteById,
  nextActionStatus,
  normalizeLiveActions,
  normalizeLiveDocuments,
  normalizeLiveJobsites,
  normalizeLiveUsers,
  safePredictStatusToApi,
  riskForecastForSite,
  siteScoped,
  siteIdFromLabel,
  summarizeSafePredictDataset,
} from "@/lib/safePredictData";

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
    expect(jobsites[0].riskScore).toBeGreaterThan(0);
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

  it("normalizes live operational records into SafePredict pages", () => {
    const dataset = buildSafePredictDataset({
      mode: "live",
      liveCompany: { name: "Test Constructors", accountType: "Live workspace" },
      liveJobsites: [{ id: "live-site-1", name: "North Pier Expansion", status: "active" }],
      liveActions: [{ id: "act-1", jobsite_id: "live-site-1", title: "Repair guardrail", status: "in_progress", severity: "high", category: "fall_hazard" }],
      liveIncidents: [{ id: "inc-1", jobsite_id: "live-site-1", title: "Near miss at stair tower", status: "open", severity: "high", incident_type: "near_miss" }],
      liveObservations: [{ id: "obs-1", jobsite_id: "live-site-1", title: "Material in walkway", status: "open", severity: "medium", category: "housekeeping" }],
      livePermits: [{ id: "permit-1", jobsite_id: "live-site-1", permit_type: "Hot Work", status: "expired" }],
      liveEmployees: [{ userId: "worker-1", name: "Sam Rivera", role: "foreman", cells: ["compliant"], profileFields: { tradeSpecialty: "Steel", jobTitle: "Foreman" } }],
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
    expect(dataset.employees[0]).toMatchObject({ name: "Sam Rivera", assignedSiteId: "live-site-1" });
    expect(dataset.employees.some((employee) => employee.name === "Alicia Moore")).toBe(true);
    expect(siteScoped(dataset.documents, "live-site-1")[0]).toMatchObject({ title: "North Pier JSA", type: "JSA", status: "Approved" });
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
