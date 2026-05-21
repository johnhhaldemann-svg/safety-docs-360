import { describe, expect, it } from "vitest";
import { EMPTY_RISK_MEMORY_FORM, buildRiskMemoryApiObject } from "./form";

describe("riskMemory form", () => {
  it("serializes sub-trade and task into the API payload", () => {
    const payload = buildRiskMemoryApiObject({
      ...EMPTY_RISK_MEMORY_FORM,
      trade: "electrical",
      subTrade: "power_distribution_feeders_branch_power",
      task: "conduit_install",
      primaryHazard: "electrical",
    });

    expect(payload).toMatchObject({
      trade: "electrical",
      subTrade: "power_distribution_feeders_branch_power",
      task: "conduit_install",
      primaryHazard: "electrical",
    });
  });

  it("remains backward-compatible when sub-trade and task are absent", () => {
    const payload = buildRiskMemoryApiObject({
      ...EMPTY_RISK_MEMORY_FORM,
      trade: "electrical",
      primaryHazard: "electrical",
    });

    expect(payload).toMatchObject({
      trade: "electrical",
      primaryHazard: "electrical",
    });
    expect(payload).toHaveProperty("subTrade", undefined);
    expect(payload).toHaveProperty("task", undefined);
  });
});
