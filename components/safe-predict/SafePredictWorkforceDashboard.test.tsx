import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SafePredictWorkforceDashboard,
  TrainingMatrixTab,
} from "@/components/safe-predict/SafePredictWorkforceDashboard";
import type { SafePredictTrainingMatrix } from "@/lib/safePredictData";

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

  it("shows licensed users and tracked no-portal workers in the training matrix roster", () => {
    const trainingMatrix: SafePredictTrainingMatrix = {
      requirements: [
        { id: "fall", title: "Fall Protection" },
        { id: "loto", title: "LOTO Authorized Worker" },
      ],
      rows: [
        {
          userId: "licensed-1",
          personType: "licensed_user",
          name: "Leslie Licensed",
          email: "leslie@example.test",
          role: "Foreman",
          profileFields: { tradeSpecialty: "Concrete", jobTitle: "Foreman" },
          cells: { fall: "match", loto: "na" },
          cellDetails: { fall: { state: "match", expiryStatus: "ok" }, loto: { state: "na" } },
        },
        {
          userId: "tracked:worker-1",
          trackedEmployeeId: "worker-1",
          personType: "tracked_employee",
          name: "Nolan No Portal",
          email: "",
          role: "Worker",
          profileFields: { tradeSpecialty: "Mechanical", jobTitle: "Pipefitter" },
          cells: { fall: "gap", loto: "na" },
          cellDetails: { fall: { state: "gap", gapKeywords: ["Fall Protection"] }, loto: { state: "na" } },
        },
        {
          userId: "tracked:visitor-1",
          trackedEmployeeId: "visitor-1",
          personType: "tracked_employee",
          name: "Pat Not Applicable",
          email: "",
          role: "Visitor",
          profileFields: { tradeSpecialty: "Visitor", jobTitle: "Observer" },
          cells: { fall: "na", loto: "na" },
          cellDetails: { fall: { state: "na" }, loto: { state: "na" } },
        },
      ],
    };

    const html = renderToStaticMarkup(<TrainingMatrixTab groups={[]} trainingMatrix={trainingMatrix} />);

    expect(html).toContain("All People");
    expect(html).toContain("Leslie Licensed");
    expect(html).toContain("Nolan No Portal");
    expect(html).toContain("Pat Not Applicable");
    expect(html).toContain("Licensed users");
    expect(html).toContain("Tracked / no portal");
    expect(html).toContain("Tracked worker / no portal access");
    expect(html).toContain("No email");
    expect(html).toContain("Not applicable");
  });
});
