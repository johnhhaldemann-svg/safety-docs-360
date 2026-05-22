import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGusEmailNotificationPayload,
  sendGusEmailNotification,
} from "@/lib/gus/gusEmailNotifications";

describe("Gus email notifications", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires confirmation before building an email", () => {
    const result = buildGusEmailNotificationPayload({
      toEmail: "safety@example.com",
      message: "Review the high risk items.",
      confirmed: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("confirmation");
    }
  });

  it("sanitizes approval language and keeps human review visible", () => {
    const result = buildGusEmailNotificationPayload({
      toEmail: "safety@example.com",
      subject: "Approved work",
      message: "This is approved and safe to start.",
      reason: "No review needed.",
      confirmed: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.subject).not.toMatch(/approved/i);
      expect(result.payload.text).toContain("Human review is required");
      expect(result.payload.text).not.toMatch(/safe to start|No review needed/i);
    }
  });

  it("skips sending when Resend is not configured", async () => {
    const result = await sendGusEmailNotification({
      toEmail: "safety@example.com",
      message: "Review the permit gap.",
      confirmed: true,
    });

    expect(result.sent).toBe(false);
    expect(result.status).toBe("skipped");
    expect(result.warning).toContain("RESEND_API_KEY");
  });

  it("sends through Resend only after confirmation", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("GUS_NOTIFICATION_FROM_EMAIL", "gus@example.com");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { from: string; to: string[]; subject: string };

      expect(init.headers).toMatchObject({
        Authorization: "Bearer re_test",
        "Content-Type": "application/json",
      });
      expect(body.from).toBe("gus@example.com");
      expect(body.to).toEqual(["safety@example.com"]);
      expect(body.subject).toContain("Review");

      return Response.json({ id: "email_123" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendGusEmailNotification({
      toEmail: "safety@example.com",
      subject: "Review permit gap",
      message: "Review the permit gap before work continues.",
      confirmed: true,
    });

    expect(result.sent).toBe(true);
    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("email_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
