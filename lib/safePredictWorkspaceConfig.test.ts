import { describe, expect, it } from "vitest";
import {
  getSafePredictWorkspaceConfig,
  safePredictWorkspaceSlugs,
} from "./safePredictWorkspaceConfig";

describe("safePredictWorkspaceConfig", () => {
  it("covers every SafePredict sidebar workspace route", () => {
    expect(safePredictWorkspaceSlugs).toEqual([
      "incidents",
      "observations",
      "corrective-actions",
      "inspections",
      "hazards",
      "training",
      "permits",
      "analytics",
      "reports",
      "settings",
    ]);
  });

  it("returns actionable local workspace metadata", () => {
    for (const slug of safePredictWorkspaceSlugs) {
      const config = getSafePredictWorkspaceConfig(slug);
      expect(config?.title).toBeTruthy();
      expect(config?.primaryAction).toBeTruthy();
      expect(config?.summary).toHaveLength(3);
    }
  });
});
