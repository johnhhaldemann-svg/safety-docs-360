import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SafePredictJobsiteDetail } from "@/components/safe-predict/SafePredictJobsites";
import { SAFE_PREDICT_RISK_INDEX_HELPER } from "@/lib/safePredictMockData";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/safe-predict/SafePredictDataProvider", async () => {
  const { buildSafePredictDataset } = await import("@/lib/safePredictData");
  const dataset = buildSafePredictDataset();
  return {
    useSafePredictData: () => ({
      dataset,
      loading: false,
      mode: "demo",
      selectedJobsiteId: "riverside",
      setSelectedJobsiteId: vi.fn(),
      setMode: vi.fn(),
      refreshLiveData: vi.fn(),
      updateActionStatus: vi.fn(),
      closeActionWithPhoto: vi.fn(),
      advanceActionStatus: vi.fn(),
      addDraftAction: vi.fn(),
      addDraftHazard: vi.fn(),
      addDraftIncident: vi.fn(),
      addDraftPermit: vi.fn(),
      updatePermit: vi.fn(),
      addDraftJobsite: vi.fn(),
    }),
  };
});

describe("SafePredictJobsiteDetail", () => {
  it("explains that the jobsite risk score is an index, not a probability", () => {
    const html = renderToStaticMarkup(<SafePredictJobsiteDetail jobsiteId="riverside" />);

    expect(html).toContain("Risk Score");
    expect(html).toContain(SAFE_PREDICT_RISK_INDEX_HELPER);
  });

  it("shows the safety manager in the jobsite summary tiles", () => {
    const html = renderToStaticMarkup(<SafePredictJobsiteDetail jobsiteId="riverside" />);

    expect(html).toContain("Safety Manager");
    expect(html).toContain("Alex Morgan");
  });

  it("shows permit view and edit actions with readiness", () => {
    const html = renderToStaticMarkup(<SafePredictJobsiteDetail jobsiteId="riverside" />);

    expect(html).toContain("Readiness");
    expect(html).toContain("Checklist incomplete");
    expect(html).toContain("View");
    expect(html).toContain("Edit");
    expect(html).not.toContain("Renew");
  });

  it("shows a site filing heat map ordered by severity", () => {
    const html = renderToStaticMarkup(<SafePredictJobsiteDetail jobsiteId="riverside" />);

    expect(html).toContain("Site Filing Heat Map");
    expect(html).not.toContain("Risk Map");

    const criticalLane = html.indexOf('data-testid="site-filing-lane-critical"');
    const highLane = html.indexOf('data-testid="site-filing-lane-high"');
    const moderateLane = html.indexOf('data-testid="site-filing-lane-medium"');
    const lowLane = html.indexOf('data-testid="site-filing-lane-low"');

    expect(criticalLane).toBeGreaterThan(-1);
    expect(highLane).toBeGreaterThan(criticalLane);
    expect(moderateLane).toBeGreaterThan(highLane);
    expect(lowLane).toBeGreaterThan(moderateLane);
    expect(html).toContain("Moderate");
  });

  it("includes filed observations and reports in the heat map", () => {
    const html = renderToStaticMarkup(<SafePredictJobsiteDetail jobsiteId="riverside" />);

    expect(html).toContain("Unprotected Edge Noted During Decking Work");
    expect(html).toContain("Observation | Open");
    expect(html).toContain('data-testid="site-filing-lane-reports"');
    expect(html).toContain("Riverside Commercial Tower Weekly Risk Summary");
  });
});
