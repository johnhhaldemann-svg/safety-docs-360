import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTrainingExpirationEmail } from "@/lib/trainingExpirationEmail";

describe("training expiration email", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends one grouped email with worker and safety manager sections", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("TRAINING_EXPIRATION_FROM_EMAIL", "training@example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.safepredict.com");
    const fetcher = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        Response.json({ id: "email-1" })
    );

    const result = await sendTrainingExpirationEmail({
      toEmail: "safety@example.com",
      companyName: "Summit Builders",
      workerItems: [
        {
          workerName: "Avery Worker",
          workerEmail: "safety@example.com",
          trainingTitle: "Fall Protection",
          expiresOn: "2026-06-04",
          daysUntilExpiry: 14,
          stage: "14d",
          jobsiteName: null,
          subjectType: "app_user",
        },
      ],
      managerItems: [
        {
          workerName: "Jordan Contractor",
          workerEmail: null,
          trainingTitle: "Hot Work",
          expiresOn: "2026-05-20",
          daysUntilExpiry: -1,
          stage: "expired",
          jobsiteName: "North Tower",
          subjectType: "contractor_employee",
        },
      ],
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ sent: true, status: "sent", providerMessageId: "email-1" });
    const body = JSON.parse(String((fetcher as any).mock.calls[0]?.[1]?.body ?? "{}")) as {
      from: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(body.from).toBe("training@example.com");
    expect(body.subject).toBe("Training expiration digest for Summit Builders");
    expect(body.html).toContain("Your training renewals");
    expect(body.html).toContain("Safety manager digest");
    expect(body.text).toContain("Worker email: missing");
    expect(body.text).toContain("https://app.safepredict.com/training-matrix");
  });

  it("skips when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("TRAINING_EXPIRATION_FROM_EMAIL", "");

    const result = await sendTrainingExpirationEmail({
      toEmail: "worker@example.com",
      companyName: "Summit Builders",
      workerItems: [
        {
          workerName: "Avery Worker",
          workerEmail: "worker@example.com",
          trainingTitle: "Fall Protection",
          expiresOn: "2026-06-04",
          daysUntilExpiry: 14,
          stage: "14d",
          subjectType: "tracked_employee",
        },
      ],
    });

    expect(result).toMatchObject({ sent: false, status: "skipped" });
    expect(result.warning).toMatch(/not configured/i);
  });

  it("reports provider failures", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("TRAINING_EXPIRATION_FROM_EMAIL", "training@example.com");
    const fetcher = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        new Response("bad sender", { status: 400 })
    );

    const result = await sendTrainingExpirationEmail({
      toEmail: "worker@example.com",
      companyName: "Summit Builders",
      workerItems: [
        {
          workerName: "Avery Worker",
          workerEmail: "worker@example.com",
          trainingTitle: "Fall Protection",
          expiresOn: "2026-06-04",
          daysUntilExpiry: 14,
          stage: "14d",
          subjectType: "tracked_employee",
        },
      ],
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ sent: false, status: "failed", warning: "bad sender" });
  });
});
