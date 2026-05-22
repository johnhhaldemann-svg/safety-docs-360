import { describe, expect, it } from "vitest";
import { isGusMicInputSupported, normalizeGusMicTranscript } from "@/components/gus/useGusSpeechInput";

describe("Gus speech input helpers", () => {
  it("normalizes mic transcripts before sending them to Gus", () => {
    expect(normalizeGusMicTranscript("  review   the lift plan   ")).toBe("review the lift plan");
    expect(normalizeGusMicTranscript("\n\n")).toBe("");
  });

  it("reports unsupported speech recognition in the test runtime", () => {
    expect(isGusMicInputSupported()).toBe(false);
  });
});
