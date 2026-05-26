import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("useGusAssistant launcher visibility", () => {
  const source = readFileSync("components/gus/useGusAssistant.ts", "utf8");

  it("keeps the manual launcher visible on allowed routes even after popup suppression", () => {
    expect(source).toContain("const isVisible = isAllowed;");
    expect(source).toContain("const canAutoShow = isAllowed && !disabledToday && !dismissed && !quietMode;");
    expect(source).toContain("if (!canAutoShow || open) return false;");
    expect(source).toContain("if (!canAutoShow || open) return undefined;");
  });

  it("exposes auto-show permission separately from rendering visibility", () => {
    expect(source).toContain("isVisible,");
    expect(source).toContain("canAutoShow,");
  });
});
