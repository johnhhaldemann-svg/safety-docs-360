import { describe, expect, it, vi } from "vitest";
import {
  buildWeatherAddress,
  normalizeZipCode,
  resolveWeatherLocation,
} from "@/lib/weather/locationResolver";

describe("weather location resolver", () => {
  it("normalizes ZIP and ZIP+4 values", () => {
    expect(normalizeZipCode("10001")).toBe("10001");
    expect(normalizeZipCode("10001-1234")).toBe("10001-1234");
    expect(normalizeZipCode("100011234")).toBe("10001-1234");
    expect(normalizeZipCode("abc")).toBeNull();
  });

  it("builds full weather addresses for Census geocoding", () => {
    expect(
      buildWeatherAddress({
        addressLine1: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
      })
    ).toBe("123 Main St, New York, NY, 10001, US");
  });

  it("uses ZIP centroid even when a full address is available", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("api.zippopotam.us/us/10001");
      return Response.json({
        places: [
          {
            latitude: "40.7506",
            longitude: "-73.9972",
            "place name": "New York",
            "state abbreviation": "NY",
          },
        ],
      });
    }) as unknown as typeof fetch;

    const result = await resolveWeatherLocation(
      { addressLine1: "123 Main St", city: "New York", state: "NY", zipCode: "10001" },
      { fetcher }
    );

    expect(result).toMatchObject({
      latitude: 40.7506,
      longitude: -73.9972,
      source: "zip_centroid",
      confidence: "low",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to full address geocoding when no ZIP is available", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("geocoding.geo.census.gov");
      return Response.json({
        result: {
          addressMatches: [
            {
              matchedAddress: "123 MAIN ST, NEW YORK, NY",
              coordinates: { x: -73.99, y: 40.75 },
            },
          ],
        },
      });
    }) as unknown as typeof fetch;

    const result = await resolveWeatherLocation(
      { addressLine1: "123 Main St", city: "New York", state: "NY" },
      { fetcher }
    );

    expect(result).toMatchObject({
      latitude: 40.75,
      longitude: -73.99,
      source: "address",
      confidence: "high",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to Geocodio ZIP centroid when only ZIP is available", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("api.geocod.io");
      return Response.json({
        results: [
          {
            location: { lat: 40.753, lng: -73.997 },
            address_components: { city: "New York", state: "NY" },
          },
        ],
      });
    }) as unknown as typeof fetch;

    const result = await resolveWeatherLocation(
      { zipCode: "10001" },
      { fetcher, geocodioApiKey: "test-key" }
    );

    expect(result).toMatchObject({
      latitude: 40.753,
      longitude: -73.997,
      source: "zip_centroid",
      confidence: "low",
    });
  });

  it("uses public ZIP centroid lookup when Geocodio is not configured", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("api.zippopotam.us/us/53022");
      return Response.json({
        places: [
          {
            latitude: "43.2286",
            longitude: "-88.1246",
            "place name": "Germantown",
            "state abbreviation": "WI",
          },
        ],
      });
    }) as unknown as typeof fetch;

    const result = await resolveWeatherLocation({ zipCode: "53022" }, { fetcher });

    expect(result).toMatchObject({
      latitude: 43.2286,
      longitude: -88.1246,
      source: "zip_centroid",
      confidence: "low",
      label: "Germantown, WI, 53022",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses public ZIP centroid lookup if configured Geocodio fails", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("api.geocod.io")) {
        return new Response("bad gateway", { status: 502 });
      }
      expect(url).toContain("api.zippopotam.us/us/53022");
      return Response.json({
        places: [
          {
            latitude: "43.2286",
            longitude: "-88.1246",
            "place name": "Germantown",
            "state abbreviation": "WI",
          },
        ],
      });
    }) as unknown as typeof fetch;

    const result = await resolveWeatherLocation(
      { zipCode: "53022" },
      { fetcher, geocodioApiKey: "test-key" }
    );

    expect(result).toMatchObject({
      latitude: 43.2286,
      longitude: -88.1246,
      source: "zip_centroid",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not fall back to full address geocoding when a ZIP lookup fails", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 503 })) as unknown as typeof fetch;

    const result = await resolveWeatherLocation(
      { zipCode: "53022", addressLine1: "N112 W17001 Mequon Rd", city: "Germantown", state: "WI" },
      { fetcher }
    );

    expect(result).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
