import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GusCompanionStage compact layout", () => {
  const source = readFileSync("components/gus/GusCompanionStage.tsx", "utf8");

  it("uses the compact Gus figure inside the compact card", () => {
    expect(source).toContain("grid h-20 w-20 shrink-0 place-items-center");
    expect(source).toContain("<GusBotFigure state={decision.botState} compact />");
  });

  it("keeps compact quick actions above decorative figure overflow", () => {
    expect(source).toContain("relative z-10 mt-3 grid grid-cols-2 gap-2");
  });
});
