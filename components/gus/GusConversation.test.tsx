import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GusConversation thought formulation UI", () => {
  const source = readFileSync("components/gus/GusConversation.tsx", "utf8");

  it("adds Ask and Formulate modes with the rough-thought placeholder", () => {
    expect(source).toContain('type GusConversationMode = "ask" | "formulate"');
    expect(source).toContain("Say or paste the rough thought...");
    expect(source).toContain("{item === \"ask\" ? \"Ask\" : \"Formulate\"}");
  });

  it("routes formulate mode to the thought draft API while leaving conversation chat intact", () => {
    expect(source).toContain('fetch("/api/gus/thought-draft"');
    expect(source).toContain('fetch("/api/gus/conversation"');
    expect(source).toContain('if (mode === "formulate")');
  });

  it("uses mic transcripts through the same mode-aware submit path", () => {
    expect(source).toContain("const speechInput = useGusSpeechInput((transcript) => {");
    expect(source).toContain("sendDraftInput(transcript);");
  });

  it("shows a copy button only for draft text responses", () => {
    const thoughtStart = source.indexOf("function ThoughtDraftDetails");
    const photoStart = source.indexOf("function PhotoReviewDetails");
    const block = source.slice(thoughtStart, photoStart);

    expect(block).toContain("Draft text");
    expect(block).toContain("onCopy");
    expect(block).toContain("<Copy");
  });

  it("renders risk flags before draft text in the formulation details", () => {
    const thoughtStart = source.indexOf("function ThoughtDraftDetails");
    const photoStart = source.indexOf("function PhotoReviewDetails");
    const block = source.slice(thoughtStart, photoStart);

    expect(block.indexOf('title="Risks"')).toBeGreaterThanOrEqual(0);
    expect(block.indexOf('title="Risks"')).toBeLessThan(block.indexOf("Draft text"));
  });
});
