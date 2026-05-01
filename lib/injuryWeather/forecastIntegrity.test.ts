import { describe, expect, it } from "vitest";
import {
  applyDuplicateIntegrityRules,
  buildForecastIntegritySummary,
  classifyForecastRecord,
  filterForecastEligibleRows,
} from "./forecastIntegrity";

const asOf = new Date("2026-05-01T12:00:00.000Z");

describe("classifyForecastRecord", () => {
  it("classifies reviewed top-rated records as verified forecast inputs", () => {
    const meta = classifyForecastRecord(
      {
        source: "sor",
        sourceId: "sor-1",
        createdAt: "2026-04-29T12:00:00.000Z",
        validationStatus: "approved",
        reviewRating: 5,
        reviewedAt: "2026-04-30T12:00:00.000Z",
        fields: {
          date: "2026-04-29",
          project: "Tower",
          trade: "Electrical",
          location: "Level 3",
          category: "Electrical",
          severity: "high",
          description: "Temporary power issue corrected.",
        },
      },
      { asOf }
    );

    expect(meta.trustLevel).toBe("verified");
    expect(meta.eligibleForForecast).toBe(true);
    expect(meta.trustWeight).toBe(1);
    expect(meta.exclusionReasons).toEqual([]);
  });

  it("blocks rejected or required-field-missing SOR records", () => {
    const rejected = classifyForecastRecord(
      {
        source: "sor",
        createdAt: "2026-04-29T12:00:00.000Z",
        validationStatus: "rejected",
        reviewRating: 1,
        fields: {
          date: "2026-04-29",
          project: "Tower",
          trade: "Concrete",
          location: "Level 2",
          category: "Struck-by",
          severity: "medium",
        },
      },
      { asOf }
    );
    const missing = classifyForecastRecord(
      {
        source: "sor",
        createdAt: "2026-04-29T12:00:00.000Z",
        validationStatus: "approved",
        reviewRating: 4,
        fields: {
          date: "",
          trade: "",
          location: "Level 2",
          category: "",
          severity: "medium",
        },
      },
      { asOf }
    );

    expect(rejected.trustLevel).toBe("blocked");
    expect(rejected.eligibleForForecast).toBe(false);
    expect(missing.exclusionReasons).toEqual(
      expect.arrayContaining(["missing_date", "missing_hazard_category", "missing_trade"])
    );
    expect(missing.eligibleForForecast).toBe(false);
  });

  it("keeps approved but incomplete records out of scoring as low-confidence context", () => {
    const meta = classifyForecastRecord(
      {
        source: "incident",
        createdAt: "2026-04-22T12:00:00.000Z",
        validationStatus: "approved",
        reviewRating: 3,
        fields: {
          date: "2026-04-22",
          category: "",
          severity: "high",
        },
      },
      { asOf }
    );

    expect(meta.trustLevel).toBe("blocked");
    expect(meta.eligibleForForecast).toBe(false);
    expect(meta.confidenceScore).toBe(0);
  });

  it("downgrades stale records to historical baseline context", () => {
    const meta = classifyForecastRecord(
      {
        source: "incident",
        createdAt: "2024-12-15T12:00:00.000Z",
        validationStatus: "approved",
        reviewRating: 5,
        reviewedAt: "2025-01-01T12:00:00.000Z",
        fields: {
          date: "2024-12-15",
          category: "Fall",
          severity: "high",
        },
      },
      { asOf }
    );

    expect(meta.trustLevel).toBe("low_confidence");
    expect(meta.eligibleForForecast).toBe(false);
    expect(meta.warnings).toContain("historical_baseline_only");
  });
});

describe("forecast integrity summary", () => {
  it("blocks duplicate records after the first matching signal", () => {
    const rows = applyDuplicateIntegrityRules([
      {
        source: "sor" as const,
        sourceId: "a",
        tradeLabel: "Roofing",
        categoryLabel: "Fall",
        created_at: "2026-04-29T12:00:00.000Z",
        severity: "high" as const,
        forecastIntegrity: classifyForecastRecord(
          {
            source: "sor",
            sourceId: "a",
            createdAt: "2026-04-29T12:00:00.000Z",
            validationStatus: "approved",
            reviewRating: 4,
            fields: {
              date: "2026-04-29",
              project: "Tower",
              trade: "Roofing",
              location: "Roof",
              category: "Fall",
              severity: "high",
              description: "Missing guardrail.",
            },
          },
          { asOf }
        ),
      },
      {
        source: "sor" as const,
        sourceId: "b",
        tradeLabel: "Roofing",
        categoryLabel: "Fall",
        created_at: "2026-04-29T12:00:00.000Z",
        severity: "high" as const,
        forecastIntegrity: classifyForecastRecord(
          {
            source: "sor",
            sourceId: "b",
            createdAt: "2026-04-29T12:00:00.000Z",
            validationStatus: "approved",
            reviewRating: 4,
            fields: {
              date: "2026-04-29",
              project: "Tower",
              trade: "Roofing",
              location: "Roof",
              category: "Fall",
              severity: "high",
              description: "Missing guardrail.",
            },
          },
          { asOf }
        ),
      },
    ]);

    expect(rows[0]?.forecastIntegrity?.eligibleForForecast).toBe(true);
    expect(rows[1]?.forecastIntegrity?.trustLevel).toBe("blocked");
    expect(rows[1]?.forecastIntegrity?.exclusionReasons).toContain("duplicate_record");
    expect(filterForecastEligibleRows(rows)).toHaveLength(1);
  });

  it("summarizes health status, missing fields, and open corrective actions", () => {
    const rows = [
      {
        source: "corrective_action" as const,
        sourceId: "capa-1",
        tradeLabel: "Electrical",
        categoryLabel: "Electrical",
        created_at: "2026-04-28T12:00:00.000Z",
        severity: "high" as const,
        status: "open" as const,
        forecastIntegrity: classifyForecastRecord(
          {
            source: "corrective_action",
            sourceId: "capa-1",
            createdAt: "2026-04-28T12:00:00.000Z",
            validationStatus: "approved",
            reviewRating: 4,
            status: "open",
            fields: {
              date: "2026-04-28",
              category: "Electrical",
              severity: "high",
              status: "open",
            },
          },
          { asOf }
        ),
      },
      {
        source: "sor" as const,
        sourceId: "sor-gap",
        tradeLabel: "Unknown",
        categoryLabel: "Fall",
        created_at: "2026-04-28T12:00:00.000Z",
        severity: "medium" as const,
        forecastIntegrity: classifyForecastRecord(
          {
            source: "sor",
            sourceId: "sor-gap",
            createdAt: "2026-04-28T12:00:00.000Z",
            validationStatus: "approved",
            reviewRating: 4,
            fields: {
              date: "2026-04-28",
              location: "Deck",
              category: "Fall",
              severity: "medium",
            },
          },
          { asOf }
        ),
      },
    ];

    const summary = buildForecastIntegritySummary(rows);

    expect(summary.totalRecordsReviewed).toBe(2);
    expect(summary.openCorrectiveActions).toBe(1);
    expect(summary.missingFieldRate).toBe(50);
    expect(summary.dataGapsByTrade[0]).toEqual({ label: "Unknown", missing: 1 });
    expect(summary.status).toBe("red");
  });
});
