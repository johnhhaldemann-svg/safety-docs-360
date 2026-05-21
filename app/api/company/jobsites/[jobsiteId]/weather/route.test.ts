import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(async () => ({ companyId: "company-1" })),
}));

vi.mock("@/lib/jobsiteAccess", () => ({
  getJobsiteAccessScope: vi.fn(async () => ({})),
  isJobsiteAllowed: vi.fn(() => true),
}));

const authSupabaseFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(async () => ({
    user: { id: "user-1" },
    role: "company_admin",
    team: "company-1",
    supabase: { from: authSupabaseFrom },
  })),
  isAdminRole: vi.fn(() => false),
  normalizeAppRole: vi.fn((role) => role),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

vi.mock("@/lib/weather/nwsClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather/nwsClient")>();
  return {
    ...actual,
    NwsClient: vi.fn().mockImplementation(function MockNwsClient() {
      return {
        getForecast: vi.fn(async () => [
          {
            date: "2026-05-21",
            name: "Today",
            highTemperature: 72,
            lowTemperature: 54,
            temperatureUnit: "F",
            precipitationChance: 60,
            precipitationTypes: ["rain"],
            shortForecast: "Showers likely",
            detailedForecast: "Rain showers likely.",
            windSpeed: "10 mph",
            windDirection: "S",
          },
        ]),
      };
    }),
  };
});

import { GET } from "@/app/api/company/jobsites/[jobsiteId]/weather/route";

function orderResult(data: unknown[]) {
  return {
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
}

function orderLimitResult(data: unknown[]) {
  return {
    order: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve({ data, error: null })),
    })),
  };
}

describe("jobsite weather route", () => {
  beforeEach(() => {
    authSupabaseFrom.mockReset();
    authSupabaseFrom.mockImplementation((table: string) => {
      if (table === "company_jobsites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      id: "jobsite-1",
                      company_id: "company-1",
                      name: "Main site",
                      zip_code: "53022",
                      weather_enabled: true,
                      weather_latitude: 43.2286,
                      weather_longitude: -88.1246,
                      weather_location_source: "zip_centroid",
                      weather_location_confidence: "medium",
                      weather_last_checked_at: "2026-05-21T15:00:00Z",
                      nws_forecast_url: "https://api.weather.gov/gridpoints/MKX/81,73/forecast",
                    },
                    error: null,
                  })
                ),
              })),
            })),
          })),
        };
      }
      if (table === "jobsite_weather_subscriptions") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => orderResult([])) })) };
      }
      if (table === "weather_alert_events") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              orderLimitResult([
                {
                  id: "alert-event-1",
                  nws_alert_id: "nws-alert-1",
                  event_name: "Flood Watch",
                  severity: "Moderate",
                  headline: "Flooding possible",
                  expires_at: "2026-05-21T23:00:00Z",
                },
              ])
            ),
          })),
        };
      }
      if (table === "weather_notification_deliveries") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => orderLimitResult([])) })) };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("returns NWS forecast days with the weather overview payload", async () => {
    const response = await GET(new Request("http://localhost/api/company/jobsites/jobsite-1/weather"), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    });
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected weather route response.");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.forecast).toMatchObject({
      sourceUrl: "https://api.weather.gov/gridpoints/MKX/81,73/forecast",
      error: null,
      days: [
        {
          date: "2026-05-21",
          highTemperature: 72,
          lowTemperature: 54,
          precipitationChance: 60,
          precipitationTypes: ["rain"],
        },
      ],
    });
    expect(body.alerts).toHaveLength(1);
  });
});
