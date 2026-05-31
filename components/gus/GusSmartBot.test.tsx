import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GusSmartBot closed launcher", () => {
  const source = readFileSync("components/gus/GusSmartBot.tsx", "utf8");

  it("opens from pointer activation as well as keyboard click activation", () => {
    expect(source).toContain("function GusSmartBot");
    expect(source).toContain("const handleOpenPointerUp");
    expect(source).toContain("const handleOpenClick");
    expect(source).toContain('className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] cursor-pointer');
    expect(source.match(/onPointerUp=\{handleOpenPointerUp\}/g)?.length).toBe(4);
    expect(source.match(/onClick=\{handleOpenClick\}/g)?.length).toBe(4);
  });

  it("keeps the primary Gus launcher accessible by name", () => {
    expect(source).toContain('aria-label={open ? "Gus AI Safety Coach is open" : "Open Gus AI Safety Coach"}');
    expect(source).toContain('aria-label="Open Gus"');
  });

  it("wires the Gus video avatar sources and 30 second rotation", () => {
    expect(source).toContain('"/gus/gus-interaction-a.mp4"');
    expect(source).toContain('"/gus/gus-interaction-b.mp4"');
    expect(source).toContain("GUS_VIDEO_AVATAR_SWITCH_INTERVAL_MS = 30_000");
    expect(source).toContain("window.setInterval");
  });

  it("keeps the video avatar muted, inline, and decorative", () => {
    expect(source).toContain("<video");
    expect(source).toContain("autoPlay");
    expect(source).toContain("muted");
    expect(source).toContain("loop");
    expect(source).toContain("playsInline");
    expect(source).toContain('preload="metadata"');
    expect(source).toContain('aria-hidden="true"');
  });

  it("falls back to the CSS Gus figure for reduced motion users", () => {
    expect(source).toContain("(prefers-reduced-motion: reduce)");
    expect(source).toContain("return <GusBotFigure state={state} compact={compact} hero={hero} />");
  });
});
