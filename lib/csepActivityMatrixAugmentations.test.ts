import { describe, expect, it } from "vitest";
import { augmentCsepActivityMatrixRow } from "@/lib/csepActivityMatrixAugmentations";

describe("augmentCsepActivityMatrixRow", () => {
  const steelTrade = "Structural Steel / Metals";
  const steelSub = "Steel erection / decking";

  it("adds full crane / rigging controls for crane picks on steel scope", () => {
    const out = augmentCsepActivityMatrixRow({
      taskTitle: "Crane picks",
      tradeLabel: steelTrade,
      subTradeLabel: steelSub,
      risk: { hazard: "Crane lift hazards", controls: ["Lift plan", "Signal persons", "Exclusion zone"], permit: "Motion Permit" },
      base: { hazards: ["Crane lift hazards"], controls: ["Lift plan", "Signal persons", "Exclusion zone"] },
    });
    expect(out.controls.some((c) => c.includes("Qualified rigger"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Wind / weather"))).toBe(true);
    expect(out.hazards.some((h) => h.toLowerCase().includes("swing radius"))).toBe(true);
  });

  it("adds welding / cutting control pack for welding tasks", () => {
    const out = augmentCsepActivityMatrixRow({
      taskTitle: "Welding",
      tradeLabel: steelTrade,
      subTradeLabel: steelSub,
      risk: { hazard: "Hot work / fire", controls: ["Fire watch"], permit: "Hot Work Permit" },
      base: { hazards: ["Hot work / fire"], controls: ["Fire watch"] },
    });
    expect(out.controls.some((c) => c.includes("Hot work permit"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Welding screens"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Cylinder storage"))).toBe(true);
  });

  it("adds decking-specific hazards and controls for decking install", () => {
    const out = augmentCsepActivityMatrixRow({
      taskTitle: "Decking install",
      tradeLabel: steelTrade,
      subTradeLabel: steelSub,
      risk: { hazard: "Falls from height", controls: ["Guardrails", "PFAS"], permit: "Ladder Permit" },
      base: { hazards: ["Falls from height"], controls: ["Guardrails", "PFAS"] },
    });
    expect(out.controls.some((c) => c.includes("Controlled decking zone"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Deck bundle placement"))).toBe(true);
    expect(out.hazards.some((h) => h.toLowerCase().includes("bundle"))).toBe(true);
  });

  it("uses material-handling pack for unload steel instead of full crane list", () => {
    const out = augmentCsepActivityMatrixRow({
      taskTitle: "Unload steel",
      tradeLabel: steelTrade,
      subTradeLabel: steelSub,
      risk: { hazard: "Struck by equipment", controls: ["Spotters"], permit: "Motion Permit" },
      base: { hazards: ["Struck by equipment"], controls: ["Spotters"] },
    });
    expect(out.controls.some((c) => c.includes("Stay clear of suspended loads"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Stacking limits"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Lift plan / pick plan"))).toBe(false);
  });

  it("adds connection controls for column erection on steel scope", () => {
    const out = augmentCsepActivityMatrixRow({
      taskTitle: "Column erection",
      tradeLabel: steelTrade,
      subTradeLabel: steelSub,
      risk: { hazard: "Falls from height", controls: ["PFAS"], permit: "Ladder Permit" },
      base: { hazards: ["Falls from height"], controls: ["PFAS"] },
    });
    expect(out.controls.some((c) => c.includes("Plumb / brace"))).toBe(true);
    expect(out.controls.some((c) => c.includes("Coordinated pick"))).toBe(true);
  });
});
