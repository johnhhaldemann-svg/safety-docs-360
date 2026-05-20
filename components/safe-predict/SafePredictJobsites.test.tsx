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

  it("shows permit view and edit actions with readiness", () => {
    const html = renderToStaticMarkup(<SafePredictJobsiteDetail jobsiteId="riverside" />);

    expect(html).toContain("Readiness");
    expect(html).toContain("Checklist incomplete");
    expect(html).toContain("View");
    expect(html).toContain("Edit");
    expect(html).not.toContain("Renew");
  });
});
