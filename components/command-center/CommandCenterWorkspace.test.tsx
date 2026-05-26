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

  it("includes the unified AI safety intelligence panel with review-safe wording", () => {
    const source = readFileSync("components/command-center/CommandCenterWorkspace.tsx", "utf8");
    const start = source.indexOf("Unified AI Safety Intelligence");
    const end = source.indexOf("Field evidence needing verification");
    const block = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain("Predictive Risk, Safety Intelligence, Gus field evidence, memory, and feedback");
    expect(block).toContain("Next verification:");
    expect(block).not.toMatch(/\bapproved\b|\bsafe\b|\bcompliant\b|\bcleared\b|\bguaranteed\b/i);
  });

  it("includes the safety field understanding panel with review-safe wording", () => {
    const source = readFileSync("components/command-center/CommandCenterWorkspace.tsx", "utf8");
    const start = source.indexOf("Safety field understanding");
    const end = source.indexOf("Field evidence needing verification");
    const block = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain("Recognized disciplines");
    expect(block).toContain("Field verification questions");
    expect(block).toContain("Hierarchy-of-controls lens");
    expect(block).not.toMatch(/\bapproved\b|\bsafe\b|\bcompliant\b|\bcleared\b|\bguaranteed\b/i);
  });

  it("includes confirmed action-word workflow controls with review-safe wording", () => {
    const source = readFileSync("components/command-center/CommandCenterWorkspace.tsx", "utf8");
    const start = source.indexOf("function executableTriggerLabel");
    const end = source.indexOf("Morning briefing");
    const block = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain("Assign reviewer");
    expect(block).toContain("Record verification");
    expect(block).toContain("Resolve with verification");
    expect(block).toContain("Dismiss with reason");
    expect(block).toContain("AI cannot approve this. Human review is required.");
    expect(block).not.toMatch(/\bapproved\b|\bsafe\b|\bcompliant\b|\bcleared\b|\bguaranteed\b/i);
  });
});
