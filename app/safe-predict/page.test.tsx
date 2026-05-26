import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SafePredictDashboardPage from "@/app/safe-predict/page";
import { buildSafePredictDataset, type SafePredictDataset } from "@/lib/safePredictData";

const mockSafePredictState = vi.hoisted(() => ({
  dataset: null as SafePredictDataset | null,
  loading: false,
}));

vi.mock("@/components/safe-predict/SafePredictDataProvider", () => ({
  useSafePredictData: () => ({
    dataset: mockSafePredictState.dataset,
    selectedJobsiteId: "all",
    setSelectedJobsiteId: vi.fn(),
    loading: mockSafePredictState.loading,
  }),
}));

function renderDashboard(dataset: SafePredictDataset, loading = false) {
  mockSafePredictState.dataset = dataset;
  mockSafePredictState.loading = loading;
  return renderToStaticMarkup(<SafePredictDashboardPage />);
}

describe("SafePredictDashboardPage", () => {
  it("renders the command center heading and neutral empty live states", () => {
    const html = renderDashboard(buildSafePredictDataset({ mode: "live" }));

    expect(html).toContain("SafePredict Command Center");
    expect(html).toContain("At a glance");
    expect(html).toContain("No data yet");
    expect(html).toContain("No open actions");
  });

  it("lists top open actions with corrective action links", () => {
    const html = renderDashboard(
      buildSafePredictDataset({
        mode: "live",
        liveCompany: { name: "Test Constructors" },
        liveJobsites: [{ id: "site-1", name: "North Pier", status: "active" }],
        liveActions: [
          {
            id: "act-1",
            jobsite_id: "site-1",
            title: "Repair edge protection",
            status: "open",
            severity: "high",
            assignee: "Alex Morgan",
            due_date: "2026-05-27",
            category: "Fall Protection",
          },
        ],
      })
    );

    expect(html).toContain("Action Queue");
    expect(html).toContain("Repair edge protection");
    expect(html).toContain('href="/safe-predict/corrective-actions#act-1"');
    expect(html).toContain('href="/safe-predict/corrective-actions"');
  });

  it("shows next action before forecast driver details", () => {
    const html = renderDashboard(buildSafePredictDataset());
    const nextActionIndex = html.indexOf("Next action");
    const driversIndex = html.indexOf("View all forecast drivers");

    expect(nextActionIndex).toBeGreaterThan(-1);
    expect(driversIndex).toBeGreaterThan(nextActionIndex);
  });
});
