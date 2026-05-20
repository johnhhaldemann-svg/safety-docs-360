import { describe, expect, it, vi } from "vitest";
import { NwsClient, parseNwsAlertFeature } from "@/lib/weather/nwsClient";

describe("NWS client", () => {
  it("parses /points metadata", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        properties: {
          gridId: "OKX",
          gridX: 33,
          gridY: 37,
          forecast: "https://api.weather.gov/gridpoints/OKX/33,37/forecast",
          forecastHourly: "https://api.weather.gov/gridpoints/OKX/33,37/forecast/hourly",
          relativeLocation: { properties: { city: "New York", state: "NY" } },
        },
      })
    ) as unknown as typeof fetch;

    const client = new NwsClient({ fetcher, userAgent: "SafetyDocs360/1.0 test@example.com" });
    await expect(client.getPointMetadata(40.75, -73.99)).resolves.toEqual({
      gridId: "OKX",
      gridX: 33,
      gridY: 37,
      forecastUrl: "https://api.weather.gov/gridpoints/OKX/33,37/forecast",
      forecastHourlyUrl: "https://api.weather.gov/gridpoints/OKX/33,37/forecast/hourly",
      relativeLocation: "New York, NY",
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/points/40.7500,-73.9900"),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": "SafetyDocs360/1.0 test@example.com" }),
      })
    );
  });

  it("parses active alert features", () => {
    expect(
      parseNwsAlertFeature({
        id: "urn:oid:alert-1",
        properties: {
          event: "Severe Thunderstorm Warning",
          severity: "Severe",
          urgency: "Immediate",
          certainty: "Likely",
          headline: "Storm warning",
          description: "Description",
          instruction: "Secure loose materials.",
          effective: "2026-05-20T19:45:00Z",
          expires: "2026-05-20T21:15:00Z",
          status: "Actual",
        },
      })
    ).toMatchObject({
      id: "urn:oid:alert-1",
      eventName: "Severe Thunderstorm Warning",
      severity: "Severe",
      instruction: "Secure loose materials.",
    });
  });
});
