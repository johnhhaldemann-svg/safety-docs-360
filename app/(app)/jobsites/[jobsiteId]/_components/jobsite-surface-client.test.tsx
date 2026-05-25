import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OverviewWidgets } from "./jobsite-surface-client";

vi.mock("@/lib/supabaseBrowser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));

describe("jobsite overview widgets", () => {
  it("renders the Top 10 Jobsite Risks board", () => {
    const html = renderToStaticMarkup(
      <OverviewWidgets
        onReload={() => undefined}
        payload={{
          jobsite: { id: "site-1", name: "Hillcrest Office Fit-Out", status: "active" },
          overview: { users: 1, jsas: 0, permits: 0, documents: 0, observations: 0, incidents: 0, reports: 0 },
          widgets: { recentIncidents: [] },
          emergencyActionPlan: { readiness: "complete", missingFields: [] },
          launchReadiness: {
            status: "hold",
            headline: "Launch hold: immediate review needed before work is released.",
            primaryBlocker: "Risk: Critical risk signal active",
            nextAction: "Resolve roof edge exposure before work proceeds.",
            criticalCount: 1,
            warningCount: 1,
            stations: [
              { id: "emergency", label: "Emergency", status: "go", summary: "Emergency profile ready", detail: "EAP is complete.", href: "/jobsites/site-1/emergency-action-plan" },
              { id: "risk", label: "Risk", status: "hold", summary: "Critical risk signal active", detail: "Falls from elevation is the leading live risk.", href: "/jobsites/site-1/live-view" },
              { id: "work_plan", label: "Work Plan", status: "review", summary: "2 work items planned", detail: "High-risk items need review.", href: "/jobsites/site-1/schedule" },
            ],
          },
          topJobsiteRisks: [
            {
              id: "falls_from_elevation",
              rank: 1,
              title: "Falls from elevation",
              riskLevel: "critical",
              score: 125,
              evidenceCount: 2,
              topDrivers: ["Incident: Roof edge fall exposure needs immediate review."],
              nextAction: "Immediate review needed. Verify fall protection before elevated work starts.",
              sources: [{ type: "incident", count: 2 }],
            },
          ],
          links: {},
        }}
      />
    );

    expect(html).toContain("Mission Control");
    expect(html).toContain("Launch Readiness");
    expect(html).toContain("HOLD");
    expect(html).toContain("REVIEW");
    expect(html).toContain("GO");
    expect(html).toContain("Top 10 Jobsite Risks");
    expect(html).toContain("Falls from elevation");
    expect(html).toContain("Immediate review needed");
    expect(html).toContain("Incident 2");
  });
});
