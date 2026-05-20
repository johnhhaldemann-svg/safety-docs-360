import { describe, expect, it } from "vitest";
import {
  fallbackAiActionSuggestion,
  parseAiActionSuggestionText,
} from "@/lib/correctiveActionAi";

describe("correctiveActionAi", () => {
  it("parses a valid JSON action suggestion", () => {
    const parsed = parseAiActionSuggestionText(JSON.stringify({
      title: "Verify guardrail replacement",
      description: "Stop work at the open edge until the guardrail is restored and photographed.",
      severity: "critical",
      category: "fall_hazard",
      dueAt: "2026-05-21T17:00:00.000Z",
      assignedUserId: "11111111-1111-4111-8111-111111111111",
      rationale: "Open-edge exposure requires immediate field verification.",
    }));

    expect(parsed).toMatchObject({
      title: "Verify guardrail replacement",
      severity: "critical",
      category: "fall_hazard",
      assignedUserId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns null for invalid model output", () => {
    expect(parseAiActionSuggestionText("not json")).toBeNull();
    expect(parseAiActionSuggestionText(JSON.stringify({ title: "Missing description" }))).toBeNull();
  });

  it("falls back to an active user when one is available", () => {
    const suggestion = fallbackAiActionSuggestion({
      risk: {
        id: "fall-risk",
        title: "Fall exposure",
        riskLevel: "high",
      },
      assignableUsers: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Avery Patel",
          email: "avery@example.com",
          role: "Safety Manager",
          status: "active",
        },
      ],
    });

    expect(suggestion.assignedUserId).toBe("11111111-1111-4111-8111-111111111111");
    expect(suggestion.warning).toBeNull();
  });
});
