import { describe, expect, it } from "vitest";
import { userVisibleInjuryModelMessage } from "./injuryModelMessage";

describe("userVisibleInjuryModelMessage", () => {
  it("uses API body on 403 when present", () => {
    expect(
      userVisibleInjuryModelMessage(403, { error: "Custom forbidden message." })
    ).toBe("Custom forbidden message.");
  });

  it("recognizes CSEP-style 403 copy", () => {
    const msg = userVisibleInjuryModelMessage(403, {
      error: "This workspace is limited to CSEP. This feature is not available on your current workspace product.",
    });
    expect(msg).toContain("CSEP");
  });

  it("503 prefers API error then timeout wording", () => {
    expect(userVisibleInjuryModelMessage(503, { error: "Injury model timed out." })).toBe("Injury model timed out.");
    expect(userVisibleInjuryModelMessage(503, null)).toContain("timed out");
  });

  it("500 falls back to generic server message", () => {
    expect(userVisibleInjuryModelMessage(500, null)).toContain("Injury model failed");
  });

  it("unknown status includes code", () => {
    expect(userVisibleInjuryModelMessage(418, null)).toContain("418");
  });
});
