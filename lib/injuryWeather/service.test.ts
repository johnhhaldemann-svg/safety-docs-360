import { describe, expect, it } from "vitest";
import { resolveMonthScopedRowsWithFallback, shiftMonthLabelByYears, workScheduleFromUrlSearchParams } from "./service";

describe("shiftMonthLabelByYears", () => {
  it("returns prior calendar year for long month labels", () => {
    expect(shiftMonthLabelByYears("April 2026", -1)).toBe("April 2025");
    expect(shiftMonthLabelByYears("January 2024", -1)).toBe("January 2023");
  });
});

describe("resolveMonthScopedRowsWithFallback", () => {
  const row = (iso: string) => ({
    trade: "General Contractor",
    category: "x",
    severity: "medium",
    created_at: iso,
    source: "sor",
  });

  it("uses primary month when rows exist", () => {
    const all = [row("2026-04-10T12:00:00.000Z"), row("2025-04-01T12:00:00.000Z")];
    const r = resolveMonthScopedRowsWithFallback(all, "April 2026");
    expect(r.rows).toHaveLength(1);
    expect(r.recordWindowLabel).toContain("Month-scoped signals: April 2026");
  });

  it("falls back to same month prior year when primary is empty", () => {
    const all = [row("2025-04-15T12:00:00.000Z")];
    const r = resolveMonthScopedRowsWithFallback(all, "April 2026");
    expect(r.rows).toHaveLength(1);
    expect(r.recordWindowLabel).toContain("prior-year fallback");
    expect(r.recordWindowLabel).toContain("April 2025");
  });

  it("falls back to all rows when primary and prior year are empty", () => {
    const all = [row("2024-08-01T12:00:00.000Z")];
    const r = resolveMonthScopedRowsWithFallback(all, "April 2026");
    expect(r.rows).toHaveLength(1);
    expect(r.recordWindowLabel).toContain("All dates (historical pool");
  });
});

describe("workScheduleFromUrlSearchParams", () => {
  it("returns undefined when no relevant query keys", () => {
    const sp = new URLSearchParams();
    expect(workScheduleFromUrlSearchParams(sp)).toBeUndefined();
    expect(workScheduleFromUrlSearchParams(new URLSearchParams("foo=bar"))).toBeUndefined();
  });

  it("parses workSevenDaysPerWeek", () => {
    expect(workScheduleFromUrlSearchParams(new URLSearchParams("workSevenDaysPerWeek=1"))).toEqual({
      workSevenDaysPerWeek: true,
    });
    expect(workScheduleFromUrlSearchParams(new URLSearchParams("workSevenDaysPerWeek=true"))).toEqual({
      workSevenDaysPerWeek: true,
    });
    expect(workScheduleFromUrlSearchParams(new URLSearchParams("workSevenDaysPerWeek=0"))).toEqual({
      workSevenDaysPerWeek: false,
    });
  });

  it("parses hoursPerDay", () => {
    expect(workScheduleFromUrlSearchParams(new URLSearchParams("hoursPerDay=10.5"))).toEqual({
      hoursPerDay: 10.5,
    });
  });

  it("combines both params", () => {
    const sp = new URLSearchParams("workSevenDaysPerWeek=1&hoursPerDay=12");
    expect(workScheduleFromUrlSearchParams(sp)).toEqual({
      workSevenDaysPerWeek: true,
      hoursPerDay: 12,
    });
  });
});
