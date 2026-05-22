import { describe, expect, it, vi } from "vitest";
import { NwsClient, parseNwsAlertFeature, parseNwsForecast } from "@/lib/weather/nwsClient";

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

    const client = new NwsClient({ fetcher, userAgent: "SafePredict/1.0 test@example.com" });
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
        headers: expect.objectContaining({ "User-Agent": "SafePredict/1.0 test@example.com" }),
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

  it("parses 5-day forecast periods with temperatures and precipitation", () => {
    const forecast = parseNwsForecast(
      {
        properties: {
          periods: [
            {
              name: "Today",
              startTime: "2026-05-21T06:00:00-05:00",
              isDaytime: true,
              temperature: 71,
              temperatureUnit: "F",
              probabilityOfPrecipitation: { value: 65 },
              shortForecast: "Showers and thunderstorms likely",
              detailedForecast: "Rain showers and thunderstorms likely.",
              windSpeed: "10 mph",
              windDirection: "S",
            },
            {
              name: "Tonight",
              startTime: "2026-05-21T18:00:00-05:00",
              isDaytime: false,
              temperature: 43,
              temperatureUnit: "F",
              probabilityOfPrecipitation: { value: 20 },
              shortForecast: "Chance showers",
              detailedForecast: "A chance of rain showers.",
            },
            {
              name: "Friday",
              startTime: "2026-05-22T06:00:00-05:00",
              isDaytime: true,
              temperature: 31,
              temperatureUnit: "F",
              probabilityOfPrecipitation: { value: null },
              shortForecast: "Snow likely",
              detailedForecast: "Snow likely before noon.",
            },
          ],
        },
      },
      5
    );

    expect(forecast[0]).toMatchObject({
      date: "2026-05-21",
      highTemperature: 71,
      lowTemperature: 43,
      precipitationChance: 65,
      precipitationTypes: ["storm", "rain"],
      windSpeed: "10 mph",
      windDirection: "S",
    });
    expect(forecast[1]).toMatchObject({
      date: "2026-05-22",
      highTemperature: 31,
      lowTemperature: 31,
      precipitationChance: null,
      precipitationTypes: ["snow"],
    });
  });
});
