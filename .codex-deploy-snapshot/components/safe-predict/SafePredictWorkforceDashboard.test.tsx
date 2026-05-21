import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SafePredictWorkforceDashboard } from "@/components/safe-predict/SafePredictWorkforceDashboard";

vi.mock("@/components/safe-predict/SafePredictDataProvider", async () => {
  const { buildSafePredictDataset } = await import("@/lib/safePredictData");
  const dataset = buildSafePredictDataset({});
  const fallbackPermit = {
    ...dataset.permits[0],
    id: "permit-none",
    type: "None",
    title: "Permit exposure",
    status: "Expired" as const,
  };
  return {
    useSafePredictData: () => ({
      dataset: {
        ...dataset,
        permits: [fallbackPermit],
        permitSummaries: [],
      },
      loading: false,
      mode: "demo",
      createCorrectiveAction: vi.fn(),
      refreshLiveData: vi.fn(),
    }),
  };
});

describe("SafePredictWorkforceDashboard", () => {
  it("does not leak None into permit action titles", () => {
    const html = renderToStaticMarkup(<SafePredictWorkforceDashboard />);

    expect(html).not.toContain("Renew or review None");
    expect(html).toContain("Renew or review expiring permit exposure");
  });
});
