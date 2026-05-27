import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GusAssistant close control", () => {
  const source = readFileSync("components/gus/GusAssistant.tsx", "utf8");

  it("dismisses Gus from the open-panel X instead of only minimizing it", () => {
    expect(source).toContain('aria-label="Close Gus"');
    expect(source).toContain('title="Close Gus"');
    expect(source).toContain("onClick={dismissAssistant}");
    expect(source).not.toContain('aria-label="Minimize Gus"');
  });
});
