import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifest", () => {
  it("uses the active SafePredict identity", () => {
    const value = JSON.stringify(manifest());

    expect(value).toContain("SafePredict");
    expect(value).not.toMatch(/Safety360Docs|SafetyDocs360|Safety360 Docs/i);
  });
});
