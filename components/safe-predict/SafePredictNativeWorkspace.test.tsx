import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SafePredictNativeWorkspace } from "@/components/safe-predict/SafePredictNativeWorkspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/safe-predict/SafePredictDataProvider", async () => {
  const { buildSafePredictDataset } = await import("@/lib/safePredictData");
  const dataset = buildSafePredictDataset({
    mode: "live",
    liveCompany: { name: "Test Constructors" },
    liveJobsites: [
      { id: "live-high", name: "North Pier Expansion", status: "active" },
      { id: "live-low", name: "South Yard Closeout", status: "active" },
    ],
    liveActions: [
      { id: "act-1", jobsite_id: "live-high", title: "Repair guardrail", status: "in_progress", severity: "high" },
      { id: "act-2", jobsite_id: "live-low", title: "Closed punch item", status: "verified_closed", severity: "low" },
    ],
    liveIncidents: [{ id: "inc-1", jobsite_id: "live-high", title: "Near miss at stair tower", status: "open", severity: "high" }],
    liveInspections: [{ id: "audit-1", jobsite_id: "live-high", title: "Daily walk", status: "failed", failed_items: 2 }],
    liveDocuments: [{ id: "doc-1", jobsite_id: "live-high", title: "North Pier JSA", document_type: "JSA", status: "approved" }],
  });

  return {
    useSafePredictData: () => ({
      dataset,
      loading: false,
      mode: "live",
      selectedJobsiteId: "live-high",
      setSelectedJobsiteId: vi.fn(),
      setMode: vi.fn(),
      updateActionStatus: vi.fn(),
      closeActionWithPhoto: vi.fn(),
      advanceActionStatus: vi.fn(),
      addDraftAction: vi.fn((input) => ({ id: "draft-action", ...input, status: "New", progress: 0 })),
      addDraftHazard: vi.fn(),
      addDraftPermit: vi.fn(),
      addDraftJobsite: vi.fn(),
    }),
  };
});

describe("SafePredictNativeWorkspace analytics", () => {
  it("scopes analytics cards, forecast, heat map, and table to the selected jobsite", () => {
    const html = renderToStaticMarkup(<SafePredictNativeWorkspace workspace="analytics" />);

    expect(html).toContain("Risk Forecast - North Pier Expansion");
    expect(html).toContain("North Pier Expansion");
    expect(html).toContain("Risk Analytics By Jobsite");
    expect(html).toContain("Selected jobsite");
    expect(html).toContain("1 jobsites");
    expect(html).toContain("1 open actions");
  });

  it("renders the new-platform document control register", () => {
    const html = renderToStaticMarkup(<SafePredictNativeWorkspace workspace="documents" />);

    expect(html).toContain("Documents");
    expect(html).toContain("Document Control Register");
    expect(html).toContain("North Pier JSA");
    expect(html).toContain("/safe-predict/documents");
  });
});
