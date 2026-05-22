import { describe, expect, it, vi } from "vitest";
import {
  canGusSpeak,
  chooseGusBrowserVoice,
  normalizeGusSpeechFormat,
  normalizeGusSpeechSpeed,
  normalizeGusTtsVoice,
  normalizeGusVoiceStyle,
  resolveGusBrowserSpeechSettings,
  resolveGusSpeechApiConfig,
  resolveGusVoiceInstructions,
  resolveGusReplaySpeechText,
  sanitizeGusSpeechText,
} from "@/lib/gus/gusVoice";

describe("Gus voice rules", () => {
  it("strips markdown, URLs, tables, and citations from spoken text", () => {
    const spoken = sanitizeGusSpeechText(`
      **Heads up.** Review the [permit checklist](https://example.com).
      | item | status |
      | --- | --- |
      See [1] and (source: OSHA page).
      This is the second sentence. This third sentence should not be spoken.
    `);

    expect(spoken).toBe("Heads up. Review the permit checklist.");
    expect(spoken).not.toContain("https://");
    expect(spoken).not.toContain("|");
    expect(spoken).not.toContain("[1]");
    expect(spoken).not.toContain("source:");
  });

  it("limits long speech to a short spoken response", () => {
    const spoken = sanitizeGusSpeechText(`${"Long safety planning sentence ".repeat(30)}.`);

    expect(spoken.length).toBeLessThanOrEqual(220);
    expect(spoken.endsWith("...")).toBe(true);
  });

  it("normalizes future voice settings safely", () => {
    expect(normalizeGusTtsVoice("marin")).toBe("marin");
    expect(normalizeGusTtsVoice("unknown")).toBe("onyx");
    expect(normalizeGusSpeechFormat("wav")).toBe("wav");
    expect(normalizeGusSpeechFormat("exe")).toBe("mp3");
    expect(normalizeGusSpeechSpeed(99)).toBe(4);
    expect(normalizeGusSpeechSpeed(0)).toBe(0.25);
    expect(normalizeGusVoiceStyle("cyborg_coach")).toBe("cyborg_coach");
    expect(normalizeGusVoiceStyle("movie_actor")).toBe("cyborg_coach");
  });

  it("resolves the cyborg coach style without actor or character imitation", () => {
    const instructions = resolveGusVoiceInstructions("cyborg_coach");
    const settings = resolveGusBrowserSpeechSettings("cyborg_coach");

    expect(instructions).toContain("deep, metallic");
    expect(instructions).toContain("AI construction safety coach");
    expect(instructions).not.toMatch(/terminator|arnold|schwarzenegger/i);
    expect(settings.pitch).toBeLessThan(1);
    expect(settings.rate).toBeLessThan(1);
  });

  it("prefers deeper English browser voices for fallback speech", () => {
    const selected = chooseGusBrowserVoice([
      { name: "Microsoft Zira", lang: "en-US" },
      { name: "Google UK English Male", lang: "en-GB" },
      { name: "Samantha", lang: "en-US", default: true },
    ]);

    expect(selected?.name).toBe("Google UK English Male");
  });

  it("keeps Gus speech on OpenAI audio instead of Vercel AI Gateway", () => {
    const gatewayConfig = resolveGusSpeechApiConfig({
      OPENAI_API_KEY: "vck_test_gateway_key",
      OPENAI_BASE_URL: "https://ai-gateway.vercel.sh/v1",
    });

    expect(gatewayConfig.apiKey).toBe("");
    expect(gatewayConfig.unavailableReason).toContain("OPENAI_TTS_API_KEY");

    const dedicatedSpeechConfig = resolveGusSpeechApiConfig({
      OPENAI_API_KEY: "vck_test_gateway_key",
      OPENAI_BASE_URL: "https://ai-gateway.vercel.sh/v1",
      OPENAI_TTS_API_KEY: "\"sk-test-tts\"",
    });

    expect(dedicatedSpeechConfig.apiKey).toBe("sk-test-tts");
    expect(dedicatedSpeechConfig.baseUrl).toBe("https://api.openai.com/v1");
    expect(dedicatedSpeechConfig.model).toBe("gpt-4o-mini-tts");
  });

  it("keeps voice off until the user opts in", () => {
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 3 },
        voiceEnabled: false,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
  });

  it("allows voice on when opted in and route is allowed", () => {
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 3 },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(true);
  });

  it("respects mute, text-only, disabled routes, and typing rules", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 3 },
        voiceEnabled: true,
        textOnlyMode: true,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
    expect(
      canGusSpeak({
        route: "/login",
        message: { category: "warning", priority: 1 },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 3 },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: now + 60_000,
        isUserTyping: false,
      }),
    ).toBe(false);
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 3 },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: true,
      }),
    ).toBe(false);
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "warning", priority: 1 },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: true,
      }),
    ).toBe(true);

    vi.useRealTimers();
  });

  it("does not speak company or jobsite scoped actions off their related page", () => {
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "risk_alert", priority: 1, actionHref: "/jobsites" },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
  });

  it("replays the last spoken message before falling back to current text", () => {
    expect(resolveGusReplaySpeechText("Last spoken message.", "Current message.")).toBe("Last spoken message.");
    expect(resolveGusReplaySpeechText("", "**Current** [message](https://example.com).")).toBe("Current message.");
  });
});
