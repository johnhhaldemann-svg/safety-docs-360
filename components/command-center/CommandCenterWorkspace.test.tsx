import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CommandCenterWorkspace AI conflict panel copy", () => {
  it("includes the predicted conflict panel and avoids release-style authority language in that block", () => {
    const source = readFileSync("components/command-center/CommandCenterWorkspace.tsx", "utf8");
    const start = source.indexOf("Predicted Workface Conflicts");
    const end = source.indexOf("Today&apos;s AI Safety Actions");
    const block = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain("Human review required before work proceeds.");
    expect(block).toContain("Missing information:");
    expect(block).not.toMatch(/\bapproved\b|\bsafe\b|\bcompliant\b|\bcleared\b|\bguaranteed\b/i);
  });
});
