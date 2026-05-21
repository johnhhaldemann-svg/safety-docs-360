import { describe, expect, it } from "vitest";
import {
  buildSurveyTestEnrichment,
  buildSurveyTestExportPayload,
  createDefaultSurveyTestForm,
  getSurveyTestTaskOptions,
  SURVEY_TEST_LAYOUT_SECTIONS,
  SURVEY_TEST_LAYOUT_VARIANT,
  SURVEY_TEST_TRADE_LABEL,
} from "./csepSurveyTest";

describe("csepSurveyTest", () => {
  it("creates a default survey-only form", () => {
    const form = createDefaultSurveyTestForm();

    expect(form.trade).toBe(SURVEY_TEST_TRADE_LABEL);
    expect(form.selectedLayoutSections).toHaveLength(SURVEY_TEST_LAYOUT_SECTIONS.length);
  });

  it("derives enrichment buckets for land survey tasks", () => {
    const form = createDefaultSurveyTestForm();
    form.subTrade = "Land survey";
    form.tasks = ["Benchmarking", "Utility locating"];
    form.selectedLayoutSections = ["risks_hazards", "training_requirements", "required_permits"];

    const enrichment = buildSurveyTestEnrichment(form);

    expect(enrichment.subTradeLabel).toBe("Land survey");
    expect(enrichment.selectedTasks).toEqual(["Benchmarking", "Utility locating"]);
    expect(enrichment.selectedSections).toHaveLength(3);
    expect(enrichment.hazards.length).toBeGreaterThan(0);
    expect(enrichment.oshaData.some((item) => item.includes("OSHA"))).toBe(true);
    expect(enrichment.requiredTraining.some((item) => item.toLowerCase().includes("utility"))).toBe(true);
    expect(enrichment.elementsRequired.some((item) => item.toLowerCase().includes("control"))).toBe(true);
  });

  it("builds an export payload that forces the survey test layout variant", () => {
    const form = createDefaultSurveyTestForm();
    form.project_name = "Survey Test";
    form.subTrade = "Building layout / as-built survey";
    form.tasks = ["Building layout", "As-built survey"];

    const payload = buildSurveyTestExportPayload(form);

    expect(payload.layoutVariant).toBe(SURVEY_TEST_LAYOUT_VARIANT);
    expect(payload.trade).toBe(SURVEY_TEST_TRADE_LABEL);
    expect(payload.surveyLayoutSections).toEqual(form.selectedLayoutSections);
    expect(payload.tasks).toEqual(["Building layout", "As-built survey"]);
  });

  it("exposes the expected selectable survey tasks", () => {
    const taskOptions = getSurveyTestTaskOptions("Land survey");

    expect(taskOptions.selectable).toContain("Benchmarking");
    expect(taskOptions.selectable).toContain("Utility locating");
  });
});
