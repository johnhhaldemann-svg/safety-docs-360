import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getGusNotificationSettingsErrorMessage } from "@/components/gus/useGusNotificationSettings";

describe("Gus notification preferences copy", () => {
  const source = readFileSync("components/gus/GusNotificationPreferencesCard.tsx", "utf8");

  it("uses field coaching and safety lead language", () => {
    expect(source).toContain("Gus field coaching notes");
    expect(source).toContain("safety lead check");
    expect(source).not.toMatch(/human review|safety review notes|record review notes/i);
  });

  it("does not expose raw auth token errors to users", () => {
    expect(getGusNotificationSettingsErrorMessage(new Error("Invalid auth token."), "Fallback")).toBe(
      "Sign in again to sync Gus notification preferences. Local preferences are still saved on this browser.",
    );
    expect(getGusNotificationSettingsErrorMessage(new Error("Network failed"), "Fallback")).toBe("Network failed");
  });
});
