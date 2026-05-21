import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isCronRequestAuthorized: vi.fn(),
  withCronTelemetry: vi.fn(),
  runTrainingExpirationNotificationCron: vi.fn(),
}));

vi.mock("@/lib/cronAuth", () => ({ isCronRequestAuthorized: mocks.isCronRequestAuthorized }));
vi.mock("@/lib/cronTelemetry", () => ({ withCronTelemetry: mocks.withCronTelemetry }));
vi.mock("@/lib/trainingExpirationNotifications", () => ({
  runTrainingExpirationNotificationCron: mocks.runTrainingExpirationNotificationCron,
}));

import { GET } from "./route";

function request(url = "https://example.com/api/cron/training-expiration-notifications") {
  return new Request(url);
}

describe("GET /api/cron/training-expiration-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCronRequestAuthorized.mockReturnValue(true);
    mocks.withCronTelemetry.mockImplementation(async (_name: string, handler: () => Promise<{ response: Response }>) => {
      const result = await handler();
      return result.response;
    });
    mocks.runTrainingExpirationNotificationCron.mockResolvedValue({
      ok: true,
      companiesSeen: 1,
      itemsSeen: 2,
      workerEmailsSent: 1,
      managerEmailsSent: 1,
      skippedMissingEmail: 0,
      duplicateDeliveries: 0,
      failedEmails: 0,
      deliveryErrors: 0,
      warnings: [],
    });
  });

  it("rejects unauthorized cron requests", async () => {
    mocks.isCronRequestAuthorized.mockReturnValue(false);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.runTrainingExpirationNotificationCron).not.toHaveBeenCalled();
  });

  it("runs the training expiration cron with telemetry and max item override", async () => {
    const response = await GET(request("https://example.com/api/cron/training-expiration-notifications?maxItems=25"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      companiesSeen: 1,
      itemsSeen: 2,
    });
    expect(mocks.withCronTelemetry).toHaveBeenCalledWith("training-expiration-notifications", expect.any(Function));
    expect(mocks.runTrainingExpirationNotificationCron).toHaveBeenCalledWith({ maxItems: 25 });
  });

  it("returns a 500 when the service role client is unavailable", async () => {
    mocks.runTrainingExpirationNotificationCron.mockResolvedValue({
      ok: false,
      error: "Missing Supabase service role key for training expiration notifications.",
    });

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "Missing Supabase service role key for training expiration notifications.",
    });
  });
});
