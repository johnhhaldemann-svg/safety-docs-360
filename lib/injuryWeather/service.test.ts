import { describe, expect, it } from "vitest";
import { workScheduleFromUrlSearchParams } from "./service";

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
