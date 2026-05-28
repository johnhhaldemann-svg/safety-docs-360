import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("useGusAssistant launcher visibility", () => {
  const source = readFileSync("components/gus/useGusAssistant.ts", "utf8");

  it("hides the manual launcher after Gus is dismissed or disabled for the day", () => {
    expect(source).toContain("const isVisible = isAllowed && !disabledToday && !dismissed;");
    expect(source).toContain("const canAutoShow = isAllowed && !disabledToday && !dismissed && !quietMode;");
    expect(source).toContain("if (!canAutoShow || open) return false;");
    expect(source).toContain("if (!canAutoShow || open) return undefined;");
  });

  it("exposes auto-show permission separately from rendering visibility", () => {
    expect(source).toContain("isVisible,");
    expect(source).toContain("canAutoShow,");
  });
});
